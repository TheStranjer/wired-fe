/**
 * Tests for the Notification schema: a mention carrying its status, a follow
 * without one, the defaults for `status` and `emoji`, Pleroma's emoji reaction
 * normalized to `'reaction'` while the raw type is kept, unknown types folding
 * to `'other'`, and the inputs that are not a notification at all. Plus the
 * full `notificationKind` mapping table.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { AccountSchema } from './account';
import type { Notification, NotificationKind } from './notification';
import { NotificationSchema, notificationKind } from './notification';
import { StatusSchema } from './status';

/** Parses {@link input}, throwing on invalid input so tests read the output. */
function parse(input: unknown): Notification {
  const result = v.safeParse(NotificationSchema, input);
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
  content: '<p>hey @lain</p>',
  visibility: 'public',
  replies_count: 0,
  reblogs_count: 0,
  favourites_count: 0,
};

/** {@link WIRE_STATUS} as the Status schema parses it, defaults and all. */
const PARSED_STATUS = v.parse(StatusSchema, WIRE_STATUS);

/** Every raw type the schema recognizes, and the kind it maps to. */
const KIND_TABLE: readonly (readonly [string, NotificationKind])[] = [
  ['mention', 'mention'],
  ['status', 'status'],
  ['reblog', 'reblog'],
  ['follow', 'follow'],
  ['follow_request', 'follow_request'],
  ['favourite', 'favourite'],
  ['poll', 'poll'],
  ['update', 'update'],
  ['reaction', 'reaction'],
  ['move', 'move'],
  ['other', 'other'],
  ['pleroma:emoji_reaction', 'reaction'],
  ['admin.sign_up', 'other'],
  ['admin.report', 'other'],
  ['pleroma:chat_mention', 'other'],
  ['severed_relationships', 'other'],
  ['', 'other'],
];

/** Inputs that must not parse at all: missing or wrongly shaped required keys. */
const BAD_NOTIFICATIONS: readonly (readonly [string, unknown])[] = [
  ['non-object input', '7'],
  ['a missing id', { type: 'follow', created_at: 'now', account: ACCOUNT }],
  ['a missing type', { id: 'n1', created_at: 'now', account: ACCOUNT }],
  ['a missing created_at', { id: 'n1', type: 'follow', account: ACCOUNT }],
  ['a missing account', { id: 'n1', type: 'follow', created_at: 'now' }],
  [
    'a broken status',
    { id: 'n1', type: 'mention', created_at: 'now', account: ACCOUNT, status: { id: '7' } },
  ],
  [
    'a numeric emoji',
    { id: 'n1', type: 'reaction', created_at: 'now', account: ACCOUNT, emoji: 3 },
  ],
];

describe(notificationKind, () => {
  it.each(KIND_TABLE)('maps %s onto the right kind', (type, kind) => {
    expect(notificationKind(type)).toBe(kind);
  });
});

describe('Notification schema', () => {
  it('parses a mention with its status', () => {
    expect(
      parse({
        id: 'n1',
        type: 'mention',
        created_at: '2026-11-12T21:14:05.000Z',
        account: ACCOUNT,
        status: WIRE_STATUS,
      }),
    ).toStrictEqual({
      id: 'n1',
      type: 'mention',
      kind: 'mention',
      created_at: '2026-11-12T21:14:05.000Z',
      account: PARSED_ACCOUNT,
      status: PARSED_STATUS,
      emoji: null,
    });
  });

  it('parses a follow without a status', () => {
    expect(
      parse({ id: 'n2', type: 'follow', created_at: '2026-11-12T21:14:05.000Z', account: ACCOUNT }),
    ).toStrictEqual({
      id: 'n2',
      type: 'follow',
      kind: 'follow',
      created_at: '2026-11-12T21:14:05.000Z',
      account: PARSED_ACCOUNT,
      status: null,
      emoji: null,
    });
  });

  it('reads an explicit null status as no post', () => {
    expect(
      parse({
        id: 'n3',
        type: 'follow',
        created_at: '2026-11-12T21:14:05.000Z',
        account: ACCOUNT,
        status: null,
      }).status,
    ).toBeNull();
  });

  it('normalizes a Pleroma emoji reaction and keeps its emoji', () => {
    const output = parse({
      id: 'n4',
      type: 'pleroma:emoji_reaction',
      created_at: '2026-11-12T21:14:05.000Z',
      account: ACCOUNT,
      status: WIRE_STATUS,
      emoji: '🔥',
    });

    expect(output.kind).toBe('reaction');
    expect(output.type).toBe('pleroma:emoji_reaction');
    expect(output.emoji).toBe('🔥');
    expect(output.status).toStrictEqual(PARSED_STATUS);
  });

  it('keeps an unknown type raw and folds the kind to other', () => {
    const output = parse({
      id: 'n5',
      type: 'admin.report',
      created_at: '2026-11-12T21:14:05.000Z',
      account: ACCOUNT,
    });

    expect(output.type).toBe('admin.report');
    expect(output.kind).toBe('other');
  });

  it('drops unknown keys such as Mastodon report and Pleroma blocks', () => {
    const output = parse({
      id: 'n6',
      type: 'follow',
      created_at: '2026-11-12T21:14:05.000Z',
      account: ACCOUNT,
      report: { id: 'r1' },
      pleroma: { conversation_id: 'c1' },
    });

    expect(new Set(Object.keys(output))).toStrictEqual(
      new Set(['id', 'type', 'kind', 'created_at', 'account', 'status', 'emoji']),
    );
  });

  it.each(BAD_NOTIFICATIONS)('fails on %s', (_name, wire) => {
    expect(v.safeParse(NotificationSchema, wire).success).toBe(false);
  });
});
