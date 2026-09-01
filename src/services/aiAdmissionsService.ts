import { getAnthropicClient, isAIConfigured } from '../config/ai';
import env from '../config/env';
import Course from '../models/Course';
import { IWhatsAppMessage } from '../models/WhatsAppMessage';

export const AI_INTENTS = [
  'greeting',
  'course_inquiry',
  'pricing_question',
  'demo_request',
  'general_question',
  'complaint',
  'other',
] as const;
export const AI_LANGUAGES = ['english', 'hindi', 'hinglish'] as const;
export const AI_TIMELINES = ['immediately', 'this_week', 'this_month', 'later', 'just_researching'] as const;
export const AI_CUSTOMER_TYPES = ['student', 'working_professional', 'job_seeker', 'career_switcher', 'other'] as const;
export const AI_ACTIONS = ['reply', 'ask_demo_preference', 'book_demo', 'escalate'] as const;

export interface AIAdmissionsResult {
  intent: (typeof AI_INTENTS)[number];
  language: (typeof AI_LANGUAGES)[number];
  course: string | null;
  timeline: (typeof AI_TIMELINES)[number] | null;
  customerType: (typeof AI_CUSTOMER_TYPES)[number] | null;
  confidence: number;
  action: (typeof AI_ACTIONS)[number];
  replyMessage: string;
  demoBooking: { preferredDate: string; preferredTime: string } | null;
  escalationReason: string | null;
}

/** A safe, non-hallucinating fallback — used whenever the AI can't be trusted to act. */
const escalationFallback = (reason: string): AIAdmissionsResult => ({
  intent: 'other',
  language: 'english',
  course: null,
  timeline: null,
  customerType: null,
  confidence: 0,
  action: 'escalate',
  replyMessage:
    "Thanks for reaching out to WebiGeeks! I'll have our counsellor confirm the details and get back to you shortly.",
  demoBooking: null,
  escalationReason: reason,
});

interface CourseSummary {
  title: string;
  duration: string;
  mode: string;
  fees: number;
  technologies: string[];
}

// Short in-process cache — course data changes rarely, and re-querying it on
// every single WhatsApp message is unnecessary DB load. Not persisted across
// restarts; that's fine, it's just a knowledge-refresh cadence.
let courseCache: { at: number; courses: CourseSummary[] } | null = null;
const COURSE_CACHE_TTL_MS = 5 * 60 * 1000;

const getActiveCourses = async (): Promise<CourseSummary[]> => {
  if (courseCache && Date.now() - courseCache.at < COURSE_CACHE_TTL_MS) {
    return courseCache.courses;
  }
  const docs = await Course.find({ isActive: true })
    .select('title duration mode fees technologies')
    .lean();
  const courses = docs.map((c) => ({
    title: c.title,
    duration: c.duration,
    mode: c.mode,
    fees: c.fees,
    technologies: c.technologies || [],
  }));
  courseCache = { at: Date.now(), courses };
  return courses;
};

/** Matches the AI's freeform course guess back to a real course title — never trusts it blindly. */
const resolveRealCourse = (guess: string | null | undefined, courses: CourseSummary[]): string | null => {
  if (!guess) return null;
  const normalized = guess.trim().toLowerCase();
  const match = courses.find(
    (c) => c.title.toLowerCase() === normalized || c.title.toLowerCase().includes(normalized) || normalized.includes(c.title.toLowerCase())
  );
  return match ? match.title : null;
};

const buildSystemPrompt = (courses: CourseSummary[], todayIso: string): string => `
You are the WebiGeeks admissions counsellor on WhatsApp. WebiGeeks is a real
technology training institute in Sector-14, Gurugram, India. You are NOT a
generic chatbot — you are an admissions counsellor whose job is to:
understand the enquiry -> qualify the lead -> build confidence -> offer a
free/paid demo class (per current config) -> book the demo.

Today's date is ${todayIso}.

THE ONLY COURSES WEBIGEEKS OFFERS (do not mention or invent any other course,
fee, or duration — this is the complete and only real list):
${courses.map((c) => `- ${c.title}: ${c.duration}, ${c.mode}, fee INR ${c.fees.toLocaleString('en-IN')}`).join('\n')}

Demo fee: ${env.DEMO_FEE_AMOUNT > 0 ? `INR ${env.DEMO_FEE_AMOUNT}` : 'free'}.

HARD RULES:
- Never invent or guess fees, discounts, schedules, placement guarantees,
  salary guarantees, or refund policies. If asked something you don't have
  verified information for, say a counsellor will confirm it, and set
  action to "escalate".
- Detect the customer's language (English, Hindi, or Hinglish) from their
  most recent message and reply naturally in that same language. Do not
  switch languages repeatedly once you've settled into one.
- Don't ask for information already given earlier in the conversation.
- Never claim a demo is booked, or a payment succeeded — those are
  confirmed by the backend only after this conversation, never by you.
- If the customer is angry, disputes a payment, asks for a refund, asks for
  a human, negotiates an unusual discount, or you are not confident you
  understood them, set action to "escalate" and explain in replyMessage
  that a counsellor will follow up.
- Keep replyMessage natural, warm, and concise — a real counsellor's
  WhatsApp message, not a wall of text.
`;

const buildHistoryText = (history: IWhatsAppMessage[]): string =>
  history
    .map((m) => `${m.direction === 'inbound' ? 'Customer' : 'WebiGeeks'}: ${m.body}`)
    .join('\n');

/**
 * Calls Claude with a forced tool-use response so the output is always a
 * validated structured object (per the brief's "AI must not directly
 * control the database" rule) — never free text the backend has to parse.
 * On ANY failure (network, malformed response, misconfiguration) this
 * returns an escalation result rather than throwing or fabricating.
 */
export const getNextAdmissionsAction = async (
  latestMessageBody: string,
  recentHistory: IWhatsAppMessage[]
): Promise<AIAdmissionsResult> => {
  if (!isAIConfigured()) {
    return escalationFallback('AI provider not configured (ANTHROPIC_API_KEY missing)');
  }

  let courses: CourseSummary[];
  try {
    courses = await getActiveCourses();
  } catch (error) {
    console.error('[ai-admissions] failed to load course data:', error);
    return escalationFallback('Failed to load course knowledge base');
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const tool = {
    name: 'respond_to_admissions_enquiry',
    description: 'Decide how to respond to a WhatsApp admissions enquiry.',
    input_schema: {
      type: 'object' as const,
      properties: {
        intent: { type: 'string', enum: AI_INTENTS as unknown as string[] },
        language: { type: 'string', enum: AI_LANGUAGES as unknown as string[] },
        course: { type: ['string', 'null'] },
        timeline: { type: ['string', 'null'], enum: [...AI_TIMELINES, null] },
        customerType: { type: ['string', 'null'], enum: [...AI_CUSTOMER_TYPES, null] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        action: { type: 'string', enum: AI_ACTIONS as unknown as string[] },
        replyMessage: { type: 'string' },
        demoBooking: {
          type: ['object', 'null'],
          properties: {
            preferredDate: { type: 'string' },
            preferredTime: { type: 'string' },
          },
        },
        escalationReason: { type: ['string', 'null'] },
      },
      required: ['intent', 'language', 'confidence', 'action', 'replyMessage'],
    },
  };

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(courses, todayIso),
      messages: [
        {
          role: 'user',
          content: `Conversation so far:\n${buildHistoryText(recentHistory)}\n\nLatest customer message: ${latestMessageBody}`,
        },
      ],
      tools: [tool as any],
      tool_choice: { type: 'tool', name: 'respond_to_admissions_enquiry' },
    });

    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      return escalationFallback('AI did not return a structured response');
    }

    const raw = toolUse.input as Record<string, unknown>;

    if (
      typeof raw.confidence !== 'number' ||
      typeof raw.action !== 'string' ||
      !(AI_ACTIONS as readonly string[]).includes(raw.action) ||
      typeof raw.replyMessage !== 'string'
    ) {
      return escalationFallback('AI returned a malformed structured response');
    }

    const resolvedCourse = resolveRealCourse(raw.course as string | null, courses);

    return {
      intent: (AI_INTENTS as readonly string[]).includes(raw.intent as string)
        ? (raw.intent as AIAdmissionsResult['intent'])
        : 'other',
      language: (AI_LANGUAGES as readonly string[]).includes(raw.language as string)
        ? (raw.language as AIAdmissionsResult['language'])
        : 'english',
      course: resolvedCourse,
      timeline: (AI_TIMELINES as readonly string[]).includes(raw.timeline as string)
        ? (raw.timeline as AIAdmissionsResult['timeline'])
        : null,
      customerType: (AI_CUSTOMER_TYPES as readonly string[]).includes(raw.customerType as string)
        ? (raw.customerType as AIAdmissionsResult['customerType'])
        : null,
      confidence: Math.max(0, Math.min(1, raw.confidence as number)),
      // Low confidence overrides whatever action the model picked — never
      // let an unconfident guess trigger a booking or a confident-sounding
      // reply.
      action: (raw.confidence as number) < 0.4 ? 'escalate' : (raw.action as AIAdmissionsResult['action']),
      replyMessage: raw.replyMessage as string,
      demoBooking:
        raw.action === 'book_demo' && raw.demoBooking && typeof raw.demoBooking === 'object'
          ? {
              preferredDate: String((raw.demoBooking as any).preferredDate || ''),
              preferredTime: String((raw.demoBooking as any).preferredTime || ''),
            }
          : null,
      escalationReason: typeof raw.escalationReason === 'string' ? raw.escalationReason : null,
    };
  } catch (error: any) {
    console.error('[ai-admissions] Anthropic call failed:', error?.message || error);
    return escalationFallback(`AI call failed: ${error?.message || 'unknown error'}`);
  }
};
