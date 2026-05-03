// _shared/claude.ts
// Thin wrapper around the Anthropic Messages API.
// All agents that generate prose use this.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function ask(prompt: string, opts: { model?: string; maxTokens?: number; system?: string } = {}) {
  const res = await client.messages.create({
    model: opts.model || 'claude-haiku-4-5-20251001',
    max_tokens: opts.maxTokens || 1024,
    system: opts.system,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = res.content[0];
  return block.type === 'text' ? block.text : '';
}
