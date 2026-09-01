import Anthropic from '@anthropic-ai/sdk';
import env from './env';

export const isAIConfigured = (): boolean => Boolean(env.ANTHROPIC_API_KEY);

// Lazily constructed, mirroring config/razorpay.ts — an unconfigured
// environment (no key) can still boot the server; the AI admissions
// service checks isAIConfigured() itself and escalates to a human instead
// of calling this when it isn't.
let client: Anthropic | null = null;

export const getAnthropicClient = (): Anthropic => {
  if (!client) {
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return client;
};

export default getAnthropicClient;
