/**
 * Tests for the Status schema: the minimal status with every default applied,
 * the three recorded fixtures (Wired quoting and reacting, Mastodon's 4.5
 * wrapper, Pleroma's `pleroma.quote`), visibility folding, recursive boosts,
 * broken quotes that never sink the parent, and the inputs that fail outright.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { AccountSchema } from './account';
import type { Status, Visibility } from './status';
import { StatusSchema } from './status';
import mastodonFixture from '../fixtures/status/mastodon.json';
import pleromaFixture from '../fixtures/status/pleroma.json';
import wiredFixture from '../fixtures/status/wired.json';

/** Parses {@link input}, throwing on invalid input so tests read the output. */
function parse(input: unknown): Status {
  const result = v.safeParse(StatusSchema, input);
  if (!result.success) {
    throw new Error(`unexpected parse failure: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

/** Asserts the parsed status has exactly the entity's own keys: nothing else. */
function expectKeys(output: Status): void {
  expect(new Set(Object.keys(output))).toStrictEqual(new Set(Object.keys(BASE)));
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
function wireStatus(id: string): Record<string, unknown> {
  return {
    id,
    uri: `https://wired.example/posts/${id}`,
    created_at: '2026-11-12T21:14:05.000Z',
    account: ACCOUNT,
    content: `<p>post ${id}</p>`,
    visibility: 'public',
    replies_count: 0,
    reblogs_count: 0,
    favourites_count: 0,
  };
}

/** What `wireStatus('1')` parses to: every optional default filled in. */
const BASE: Status = {
  id: '1',
  uri: 'https://wired.example/posts/1',
  url: null,
  created_at: '2026-11-12T21:14:05.000Z',
  edited_at: null,
  account: PARSED_ACCOUNT,
  content: '<p>post 1</p>',
  spoiler_text: '',
  sensitive: false,
  visibility: 'public',
  language: null,
  in_reply_to_id: null,
  in_reply_to_account_id: null,
  reblog: null,
  quote: null,
  media_attachments: [],
  mentions: [],
  tags: [],
  emojis: [],
  poll: null,
  replies_count: 0,
  reblogs_count: 0,
  favourites_count: 0,
  favourited: false,
  reblogged: false,
  bookmarked: false,
  pinned: false,
  muted: false,
  emoji_reactions: [],
  local_only: false,
  conversation_id: null,
};

/** {@link BASE} as the parsed version of `wireStatus(id)`. */
function baseAs(id: string): Status {
  return { ...BASE, id, uri: `https://wired.example/posts/${id}`, content: `<p>post ${id}</p>` };
}

/** Wire visibility to parsed visibility: known values pass, the rest fold. */
const VISIBILITY_CASES: readonly (readonly [string, Visibility])[] = [
  ['public', 'public'],
  ['unlisted', 'unlisted'],
  ['private', 'private'],
  ['direct', 'direct'],
  ['local', 'local'],
  ['list', 'private'],
  ['home', 'private'],
  ['', 'private'],
];

/** Inputs that must not parse at all: not an object, or fields of the wrong type. */
const BAD_STATUSES: readonly (readonly [string, unknown])[] = [
  ['non-object input', 'lain'],
  ['a numeric content', { ...wireStatus('1'), content: 42 }],
  ['a numeric visibility', { ...wireStatus('1'), visibility: 7 }],
  ['a negative counter', { ...wireStatus('1'), reblogs_count: -1 }],
];

/** Raw quote values that do hold a status, as each backend sends them. */
const QUOTE_CARRIERS: readonly (readonly [string, unknown])[] = [
  ['the Wired top level', wireStatus('9')],
  ['the Mastodon wrapper', { state: 'accepted', quoted_status: wireStatus('9') }],
];

/** Raw quote values that must leave the status without a quote. */
const EMPTY_QUOTES: readonly (readonly [string, unknown])[] = [
  ['a null quote', null],
  ['a null quoted_status', { state: 'accepted', quoted_status: null }],
  ['the shallow wrapper', { state: 'rejected', quoted_status_id: '9' }],
  ['a broken object', { id: '9' }],
  ['a string', 'AhZQnotanobject'],
];

describe('Status schema', () => {
  it('applies every default to the minimal status', () => {
    expect(parse(wireStatus('1'))).toStrictEqual(BASE);
  });

  it.each(VISIBILITY_CASES)('reads the visibility %s as %s', (wire, expected) => {
    expect(parse({ ...wireStatus('1'), visibility: wire }).visibility).toBe(expected);
  });

  it('derives local_only from the visibility, never from pleroma.local', () => {
    expect(parse({ ...wireStatus('1'), visibility: 'local' }).local_only).toBe(true);
    expect(parse({ ...wireStatus('1'), pleroma: { local: true } }).local_only).toBe(false);
  });

  it.each(Object.keys(wireStatus('1')))('fails without the required %s', (key) => {
    const wire = Object.fromEntries(
      Object.entries(wireStatus('1')).filter(([name]) => name !== key),
    );

    expect(v.safeParse(StatusSchema, wire).success).toBe(false);
  });

  it.each(BAD_STATUSES)('fails on %s', (_name, wire) => {
    expect(v.safeParse(StatusSchema, wire).success).toBe(false);
  });

  it.each(QUOTE_CARRIERS)('parses the quote carried by %s', (_name, quote) => {
    expect(parse({ ...wireStatus('1'), quote }).quote).toStrictEqual(baseAs('9'));
  });

  it.each(EMPTY_QUOTES)('finds no quote in %s', (_name, quote) => {
    expect(parse({ ...wireStatus('1'), quote }).quote).toBeNull();
  });

  it('reads the pleroma mirror when the top level carries no quote', () => {
    const mirror = parse({ ...wireStatus('1'), pleroma: { quote: wireStatus('9') } });

    expect(mirror.quote).toStrictEqual(baseAs('9'));
  });

  it('parses boosts, normalizing the inner status recursively', () => {
    const boosted = parse({
      ...wireStatus('1'),
      reblog: { ...wireStatus('9'), reblog: wireStatus('8') },
    });

    expect(boosted.reblog?.quote).toBeNull();
    expect(boosted.reblog?.reblog).toStrictEqual(baseAs('8'));
  });

  it('parses the Wired fixture: full quote, reactions, pleroma ids', () => {
    const output = parse(wiredFixture);

    expect(output.quote).toStrictEqual(parse(wiredFixture.quote));
    expect(output.emoji_reactions).toStrictEqual([
      { name: '❤️', count: 3, me: true, url: null },
      { name: 'lain', count: 1, me: false, url: 'https://wired.example/emoji/lain.gif' },
    ]);
    expect(output.conversation_id).toBe('AhZconvW1r3d000000000001');
    expect(output.local_only).toBe(false);

    expectKeys(output);
  });

  it('parses the Mastodon fixture: quote from the wrapper, no reactions', () => {
    const output = parse(mastodonFixture);

    expect(output.quote?.id).toBe('115213998877665544');
    expect(output.emoji_reactions).toStrictEqual([]);
    expect(output.conversation_id).toBeNull();
    expect(output.tags).toStrictEqual([
      { name: 'lain', url: 'https://mastodon.example/tags/lain' },
    ]);

    expectKeys(output);
  });

  it('parses the Pleroma fixture: quote from the block, numeric conversation', () => {
    const output = parse(pleromaFixture);

    expect(output.quote?.id).toBe('9tQU0t3dStatusFr0mAkk0ma');
    expect(output.emoji_reactions).toStrictEqual([
      { name: '🔥', count: 2, me: false, url: null },
      { name: '🐰', count: 1, me: true, url: null },
    ]);
    expect(output.conversation_id).toBe('98765');
    expect(output.local_only).toBe(false);

    expectKeys(output);
  });
});
