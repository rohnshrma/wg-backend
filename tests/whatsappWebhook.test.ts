import crypto from 'crypto';
import request from 'supertest';
import app from '../src/app';
import User from '../src/models/User';
import Enquiry from '../src/models/Enquiry';
import WhatsAppMessage from '../src/models/WhatsAppMessage';
import WhatsAppWebhookEvent from '../src/models/WhatsAppWebhookEvent';
import DemoBooking from '../src/models/DemoBooking';
import { connectTestDB, clearTestDB, disconnectTestDB } from './setup/db';
import { isWhatsAppAutomationEnabled, hasWhatsAppAppSecret } from '../src/config/whatsappAutomation';
import { getNextAdmissionsAction } from '../src/services/aiAdmissionsService';
import { sendWhatsAppText } from '../src/services/whatsappService';

jest.mock('../src/config/whatsappAutomation');
jest.mock('../src/services/aiAdmissionsService');
jest.mock('../src/services/whatsappService', () => ({
  sendWhatsAppText: jest.fn().mockResolvedValue(true),
}));

const mockIsEnabled = isWhatsAppAutomationEnabled as jest.Mock;
const mockHasAppSecret = hasWhatsAppAppSecret as jest.Mock;
const mockGetNextAction = getNextAdmissionsAction as jest.Mock;
const mockSendText = sendWhatsAppText as jest.Mock;

const APP_SECRET = process.env.WHATSAPP_APP_SECRET as string;
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN as string;

function sign(rawBody: string): string {
  return 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');
}

function messagePayload(overrides: Record<string, unknown> = {}) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ profile: { name: 'Rahul Test' }, wa_id: '919876543210' }],
              messages: [
                {
                  id: 'wamid.TEST1',
                  from: '919876543210',
                  timestamp: `${Math.floor(Date.now() / 1000)}`,
                  type: 'text',
                  text: { body: 'Hi, I am interested in the MERN course' },
                  ...overrides,
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

async function postWebhook(payload: Record<string, unknown>) {
  const raw = JSON.stringify(payload);
  return request(app)
    .post('/api/webhooks/whatsapp')
    .set('Content-Type', 'application/json')
    .set('X-Hub-Signature-256', sign(raw))
    .send(raw);
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 100));

beforeAll(async () => {
  await connectTestDB();
});

afterEach(async () => {
  await clearTestDB();
  jest.clearAllMocks();
});

afterAll(async () => {
  await disconnectTestDB();
});

describe('GET /api/webhooks/whatsapp (Meta verification)', () => {
  it('echoes the challenge for a valid verify token', async () => {
    const res = await request(app)
      .get('/api/webhooks/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': VERIFY_TOKEN, 'hub.challenge': '12345' });
    expect(res.status).toBe(200);
    expect(res.text).toBe('12345');
  });

  it('rejects an invalid verify token', async () => {
    const res = await request(app)
      .get('/api/webhooks/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': '12345' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/webhooks/whatsapp — feature flag', () => {
  it('does nothing at all when automation is disabled', async () => {
    mockIsEnabled.mockReturnValue(false);

    const res = await postWebhook(messagePayload());
    expect(res.status).toBe(200);

    await flush();
    expect(await Enquiry.countDocuments()).toBe(0);
    expect(await WhatsAppMessage.countDocuments()).toBe(0);
    expect(await WhatsAppWebhookEvent.countDocuments()).toBe(0);
    expect(mockGetNextAction).not.toHaveBeenCalled();
    expect(mockSendText).not.toHaveBeenCalled();
  });
});

describe('POST /api/webhooks/whatsapp — signature verification', () => {
  beforeEach(() => {
    mockIsEnabled.mockReturnValue(true);
    mockHasAppSecret.mockReturnValue(true);
  });

  it('rejects a request with an invalid signature', async () => {
    const raw = JSON.stringify(messagePayload());
    const res = await request(app)
      .post('/api/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', 'sha256=deadbeef')
      .send(raw);
    expect(res.status).toBe(403);
    expect(await WhatsAppWebhookEvent.countDocuments()).toBe(0);
  });
});

describe('POST /api/webhooks/whatsapp — new enquiry + AI reply', () => {
  beforeEach(async () => {
    mockIsEnabled.mockReturnValue(true);
    mockHasAppSecret.mockReturnValue(true);
    await User.create({
      email: process.env.ADMIN_EMAIL,
      password: 'Password123!',
      name: 'Admin',
      role: 'admin',
    });
  });

  it('creates an Enquiry, logs the conversation, and sends the AI reply', async () => {
    mockGetNextAction.mockResolvedValue({
      intent: 'course_inquiry',
      language: 'english',
      course: null,
      timeline: 'this_month',
      customerType: 'working_professional',
      confidence: 0.9,
      action: 'reply',
      replyMessage: 'Great choice! MERN is a 7-month hands-on program. Would you like to book a free demo?',
      demoBooking: null,
      escalationReason: null,
    });

    const res = await postWebhook(messagePayload());
    expect(res.status).toBe(200);

    await flush();

    const enquiry = await Enquiry.findOne({ mobile: '9876543210' });
    expect(enquiry).not.toBeNull();
    expect(enquiry!.source).toBe('whatsapp');
    expect(enquiry!.stage).toBe('new_enquiry');

    const messages = await WhatsAppMessage.find({ enquiryId: enquiry!._id }).sort({ timestamp: 1 });
    expect(messages).toHaveLength(2);
    expect(messages[0].direction).toBe('inbound');
    expect(messages[1].direction).toBe('outbound');

    expect(mockSendText).toHaveBeenCalledWith(
      '919876543210',
      expect.stringContaining('Would you like to book a free demo?')
    );
  });

  it('does not create a second Enquiry for a redelivered webhook (same message id)', async () => {
    mockGetNextAction.mockResolvedValue({
      intent: 'greeting',
      language: 'english',
      course: null,
      timeline: null,
      customerType: null,
      confidence: 0.9,
      action: 'reply',
      replyMessage: 'Hello! How can I help you today?',
      demoBooking: null,
      escalationReason: null,
    });

    const payload = messagePayload();
    await postWebhook(payload);
    await flush();
    await postWebhook(payload); // Meta redelivery of the exact same message id
    await flush();

    expect(await Enquiry.countDocuments()).toBe(1);
    expect(await WhatsAppMessage.countDocuments({ direction: 'inbound' })).toBe(1);
    expect(mockGetNextAction).toHaveBeenCalledTimes(1);
  });

  it('does not create a second Enquiry for a second message from the same active customer', async () => {
    mockGetNextAction.mockResolvedValue({
      intent: 'greeting',
      language: 'english',
      course: null,
      timeline: null,
      customerType: null,
      confidence: 0.9,
      action: 'reply',
      replyMessage: 'Hello!',
      demoBooking: null,
      escalationReason: null,
    });

    await postWebhook(messagePayload({ id: 'wamid.TEST1' }));
    await flush();
    await postWebhook(
      messagePayload({ id: 'wamid.TEST2', text: { body: 'Also tell me the fees' } })
    );
    await flush();

    expect(await Enquiry.countDocuments()).toBe(1);
    expect(await WhatsAppMessage.countDocuments({ direction: 'inbound' })).toBe(2);
  });

  it('books a demo, moves the enquiry to demo_scheduled, and confirms only after the DB write succeeds', async () => {
    mockGetNextAction.mockResolvedValue({
      intent: 'demo_request',
      language: 'english',
      course: 'Full Stack / MERN Development',
      timeline: 'this_week',
      customerType: 'working_professional',
      confidence: 0.95,
      action: 'book_demo',
      replyMessage: 'Booking your demo now...',
      demoBooking: { preferredDate: '2026-08-30', preferredTime: '6:00 PM' },
      escalationReason: null,
    });

    const res = await postWebhook(messagePayload());
    expect(res.status).toBe(200);
    await flush();

    const enquiry = await Enquiry.findOne({ mobile: '9876543210' });
    expect(enquiry!.stage).toBe('demo_scheduled');

    const booking = await DemoBooking.findOne({ enquiryId: enquiry!._id });
    expect(booking).not.toBeNull();
    expect(booking!.status).toBe('scheduled');
    expect(booking!.preferredDate).toBe('2026-08-30');

    expect(mockSendText).toHaveBeenCalledWith(
      '919876543210',
      expect.stringContaining('confirmed for 2026-08-30 at 6:00 PM')
    );
  });

  it('escalates instead of replying normally when the AI signals escalation', async () => {
    mockGetNextAction.mockResolvedValue({
      intent: 'complaint',
      language: 'english',
      course: null,
      timeline: null,
      customerType: null,
      confidence: 0.2,
      action: 'escalate',
      replyMessage: "I'll have our counsellor confirm that for you.",
      demoBooking: null,
      escalationReason: 'Customer disputed a payment',
    });

    await postWebhook(messagePayload({ text: { body: 'I want a refund, this is unacceptable' } }));
    await flush();

    const enquiry = await Enquiry.findOne({ mobile: '9876543210' });
    expect(enquiry!.requiresHumanFollowUp).toBe(true);
    expect(enquiry!.humanFollowUpReason).toBe('Customer disputed a payment');
  });

  it('stops auto-replying once an enquiry is already flagged for human follow-up', async () => {
    const enquiry = await Enquiry.create({
      name: 'Rahul Test',
      course: 'Not yet specified',
      mobile: '9876543210',
      source: 'whatsapp',
      stage: 'new_enquiry',
      owner: (await User.findOne({ email: process.env.ADMIN_EMAIL }))!._id,
      createdBy: (await User.findOne({ email: process.env.ADMIN_EMAIL }))!._id,
      requiresHumanFollowUp: true,
      humanFollowUpReason: 'Customer disputed a payment',
      stageHistory: [],
    });

    await postWebhook(messagePayload());
    await flush();

    expect(mockGetNextAction).not.toHaveBeenCalled();
    expect(mockSendText).not.toHaveBeenCalled();
    // The message is still logged so a human sees the full thread.
    expect(await WhatsAppMessage.countDocuments({ enquiryId: enquiry._id, direction: 'inbound' })).toBe(1);
  });

  it('escalates after a streak of borderline-confident replies even though none individually hit the hard floor', async () => {
    mockGetNextAction
      .mockResolvedValueOnce({
        intent: 'course_inquiry',
        language: 'english',
        course: null,
        timeline: null,
        customerType: null,
        confidence: 0.5,
        action: 'reply',
        replyMessage: 'Could you tell me a bit more about what you are looking for?',
        demoBooking: null,
        escalationReason: null,
      })
      .mockResolvedValueOnce({
        intent: 'other',
        language: 'english',
        course: null,
        timeline: null,
        customerType: null,
        confidence: 0.5,
        action: 'reply',
        replyMessage: 'Sorry, could you clarify that again?',
        demoBooking: null,
        escalationReason: null,
      })
      .mockResolvedValueOnce({
        intent: 'other',
        language: 'english',
        course: null,
        timeline: null,
        customerType: null,
        confidence: 0.5,
        action: 'reply',
        replyMessage: 'One more time, what course are you interested in?',
        demoBooking: null,
        escalationReason: null,
      });

    await postWebhook(messagePayload({ id: 'wamid.A' }));
    await flush();
    await postWebhook(messagePayload({ id: 'wamid.B', text: { body: 'hmm' } }));
    await flush();
    await postWebhook(messagePayload({ id: 'wamid.C', text: { body: 'what' } }));
    await flush();

    const enquiry = await Enquiry.findOne({ mobile: '9876543210' });
    expect(enquiry!.requiresHumanFollowUp).toBe(true);
    expect(enquiry!.humanFollowUpReason).toBe('Repeated low-confidence responses across the conversation');
  });

  it('does not book a second demo for an enquiry that already has one scheduled', async () => {
    mockGetNextAction.mockResolvedValue({
      intent: 'demo_request',
      language: 'english',
      course: 'Full Stack / MERN Development',
      timeline: 'this_week',
      customerType: null,
      confidence: 0.95,
      action: 'book_demo',
      replyMessage: 'Booking...',
      demoBooking: { preferredDate: '2026-08-30', preferredTime: '6:00 PM' },
      escalationReason: null,
    });

    await postWebhook(messagePayload({ id: 'wamid.TEST1' }));
    await flush();
    await postWebhook(
      messagePayload({ id: 'wamid.TEST2', text: { body: 'Actually can we do it tomorrow instead' } })
    );
    await flush();

    expect(await DemoBooking.countDocuments()).toBe(1);
    expect(mockSendText).toHaveBeenLastCalledWith(
      '919876543210',
      expect.stringContaining('already have a demo scheduled')
    );
  });
});
