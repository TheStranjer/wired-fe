/**
 * Tests for the status `pleroma` block schema: the full Wired/Pleroma status
 * block (quote kept raw, unknown keys dropped), the all-defaults empty block,
 * conversation-id normalisation, and a malformed reaction failing the block.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import type { StatusPleroma } from './statusPleroma';
import { StatusPleromaSchema } from './statusPleroma';

/** Parses {@link input}, throwing on invalid input so tests read the output. */
function parse(input: unknown): StatusPleroma {
  const result = v.safeParse(StatusPleromaSchema, input);
  if (!result.success) {
    throw new Error(`unexpected parse failure: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

/** The nested status, kept as-is; only a couple of keys stand in for a whole one. */
const QUOTE_STATUS = { id: '10', uri: 'https://wired.example/posts/10', content: '<p>hi</p>' };

describe('StatusPleroma schema', () => {
  it('parses a full block, keeping the quote raw and dropping unused keys', () => {
    expect(
      parse({
        local: true,
        conversation_id: '9',
        in_reply_to_account_acct: null,
        emoji_reactions: [
          { name: '🔥', count: 2, me: true, url: null, account_ids: ['1'] },
          { name: '👍', count: 1 },
        ],
        quote: QUOTE_STATUS,
        quote_visible: true,
        thread_muted: false,
        expires_at: null,
        content: { 'text/plain': 'hello' },
      }),
    ).toStrictEqual({
      local: true,
      conversation_id: '9',
      emoji_reactions: [
        { name: '🔥', count: 2, me: true, url: null },
        { name: '👍', count: 1, me: false, url: null },
      ],
      quote: QUOTE_STATUS,
      thread_muted: false,
      expires_at: null,
    });
  });

  it('applies every default to an empty block', () => {
    expect(parse({})).toStrictEqual({
      local: false,
      conversation_id: null,
      emoji_reactions: [],
      quote: null,
      thread_muted: false,
      expires_at: null,
    });
  });

  it('normalises a numeric conversation_id to a string', () => {
    expect(parse({ conversation_id: 9 }).conversation_id).toBe('9');
  });

  it('keeps an explicit null conversation_id', () => {
    expect(parse({ conversation_id: null }).conversation_id).toBeNull();
  });

  it('keeps an explicit null expires_at', () => {
    expect(parse({ expires_at: null }).expires_at).toBeNull();
  });

  it('keeps a scheduled expires_at string', () => {
    expect(parse({ expires_at: '2026-11-20T00:00:00Z' }).expires_at).toBe('2026-11-20T00:00:00Z');
  });

  it('fails the whole block on a malformed reaction entry', () => {
    expect(
      v.safeParse(StatusPleromaSchema, { emoji_reactions: [{ name: '🔥', count: -2 }] }).success,
    ).toBe(false);
  });

  it('fails the whole block when emoji_reactions is not an array', () => {
    expect(v.safeParse(StatusPleromaSchema, { emoji_reactions: '🔥' }).success).toBe(false);
  });

  it('fails on a non-object input', () => {
    expect(v.safeParse(StatusPleromaSchema, 'pleroma').success).toBe(false);
  });
});
