/**
 * Tests for the Conversation schema: a full conversation normalized through
 * the Account and Status schemas, the defaults for `unread` and
 * `last_status`, Pleroma's `recipients` block dropped, and the inputs that
 * are not a conversation at all.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { AccountSchema } from './account';
import type { Conversation } from './conversation';
import { ConversationSchema } from './conversation';
import { StatusSchema } from './status';

/** Parses {@link input}, throwing on invalid input so tests read the output. */
function parse(input: unknown): Conversation {
  const result = v.safeParse(ConversationSchema, input);
  if (!result.success) {
    throw new Error(`unexpected parse failure: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

/** The twelve fields every backend sends for an account. */
const ACCOUNT = {
  id: '1',
  username: 'lain',
  acct: 'lain@wired.example',
  display_name: 'Lain Iwakura',
  created_at: '1998-07-06T00:00:00.000Z',
  note: '<p>Close the world. Open the nExt.</p>',
  url: 'https://wired.example/users/lain',
  avatar: 'https://wired.example/avatars/lain.png',
  header: 'https://wired.example/headers/lain.jpg',
  followers_count: 42,
  following_count: 17,
  statuses_count: 256,
};

/** {@link ACCOUNT} as the schema parses it, with its own defaults applied. */
const PARSED_ACCOUNT = v.parse(AccountSchema, ACCOUNT);

/** The nine required fields of a status, as the wire carries them. */
const WIRE_STATUS = {
  id: '7',
  uri: 'https://wired.example/posts/7',
  created_at: '2026-11-12T21:14:05.000Z',
  account: ACCOUNT,
  content: '<p>is anyone there?</p>',
  visibility: 'direct',
  replies_count: 0,
  reblogs_count: 0,
  favourites_count: 0,
};

/** {@link WIRE_STATUS} as the Status schema parses it, defaults and all. */
const PARSED_STATUS = v.parse(StatusSchema, WIRE_STATUS);

/** Inputs that must not parse at all: missing or wrongly shaped required keys. */
const BAD_CONVERSATIONS: readonly (readonly [string, unknown])[] = [
  ['non-object input', '7'],
  ['a missing id', { accounts: [ACCOUNT] }],
  ['a missing accounts array', { id: 'c1' }],
  ['a numeric unread', { id: 'c1', accounts: [], unread: 1 }],
  ['a broken last_status', { id: 'c1', accounts: [], last_status: { id: '7' } }],
];

describe('Conversation schema', () => {
  it('parses a full conversation', () => {
    expect(
      parse({
        id: 'c1',
        accounts: [ACCOUNT],
        unread: true,
        last_status: WIRE_STATUS,
      }),
    ).toStrictEqual({
      id: 'c1',
      accounts: [PARSED_ACCOUNT],
      unread: true,
      last_status: PARSED_STATUS,
    });
  });

  it('defaults unread and last_status when they are absent', () => {
    expect(parse({ id: 'c2', accounts: [] })).toStrictEqual({
      id: 'c2',
      accounts: [],
      unread: false,
      last_status: null,
    });
  });

  it('reads an explicit null last_status as no post', () => {
    expect(
      parse({ id: 'c3', accounts: [], unread: false, last_status: null }).last_status,
    ).toBeNull();
  });

  it('drops the pleroma recipients block', () => {
    const output = parse({
      id: 'c4',
      accounts: [ACCOUNT],
      unread: false,
      last_status: WIRE_STATUS,
      pleroma: { recipients: ['https://wired.example/users/lain'] },
    });

    expect(output).toStrictEqual({
      id: 'c4',
      accounts: [PARSED_ACCOUNT],
      unread: false,
      last_status: PARSED_STATUS,
    });
    expect(new Set(Object.keys(output))).toStrictEqual(
      new Set(['id', 'accounts', 'unread', 'last_status']),
    );
  });

  it.each(BAD_CONVERSATIONS)('fails on %s', (_name, wire) => {
    expect(v.safeParse(ConversationSchema, wire).success).toBe(false);
  });
});
