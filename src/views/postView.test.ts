/**
 * Tests for postView: the plain local status with its username nick, the
 * recorded Wired fixture, a remote acct that keeps its host, a boost showing
 * the original under the booster's name, and the three answers to "is this
 * me?". The metadata the row shows after the body has its own file,
 * postView.meta.test.ts; the poll, the quote and the attachments under it
 * have theirs; these tests still name every field a row gets.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { postView } from './postView';
import wiredFixture from '../api/fixtures/status/wired.json';
import { StatusSchema } from '../api/schemas/status';
import type { Status } from '../api/schemas/status';

const ORIGIN = 'https://wired.example';

/** The viewer when nobody is signed in. */
const SIGNED_OUT = { origin: ORIGIN, accountId: null };

/** Parses {@link input} as a Status, throwing on invalid input. */
function parse(input: unknown): Status {
  const result = v.safeParse(StatusSchema, input);
  if (!result.success) {
    throw new Error(`unexpected parse failure: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

/** The twelve fields every backend sends for an account. */
function wireAccount(id: string, username: string, acct: string): Record<string, unknown> {
  return {
    id,
    username,
    acct,
    display_name: username,
    created_at: '1998-07-06T00:00:00.000Z',
    note: '',
    url: `https://wired.example/users/${username}`,
    avatar: `https://wired.example/avatars/${username}.png`,
    header: `https://wired.example/headers/${username}.jpg`,
    followers_count: 0,
    following_count: 0,
    statuses_count: 0,
  };
}

/** The nine required fields of a status, with {@link overrides} merged in. */
function wireStatus(
  id: string,
  account: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    uri: `https://wired.example/posts/${id}`,
    created_at: '2026-11-12T21:14:05.000Z',
    account,
    content: `<p>post ${id}</p>`,
    visibility: 'public',
    replies_count: 0,
    reblogs_count: 0,
    favourites_count: 0,
    ...overrides,
  };
}

/** The metadata of a status nothing has happened to: no reply, no audience,
 * no tallies, no attachments. */
const QUIET = {
  replyTo: null,
  visibility: 'public',
  edited: false,
  counts: { replies: 0, boosts: 0, favourites: 0 },
  mine: { boosted: false, favourited: false, bookmarked: false },
  reactions: [],
  media: [],
  emojis: [],
  sensitive: false,
  poll: null,
  quote: null,
} as const;

describe(postView, () => {
  it('maps a local status onto a plain row', () => {
    const status = parse(wireStatus('1', wireAccount('acc-lain', 'lain', 'lain')));

    expect(postView(status, SIGNED_OUT)).toStrictEqual({
      id: '1',
      date: new Date('2026-11-12T21:14:05.000Z'),
      author: { handle: 'lain', fullHandle: '@lain@wired.example', self: false },
      contentHtml: '<p>post 1</p>',
      spoilerText: '',
      boostedBy: null,
      ...QUIET,
    });
  });

  it('maps the recorded Wired status', () => {
    const status = parse(wiredFixture);

    expect(postView(status, SIGNED_OUT)).toStrictEqual({
      id: 'AhZQp4rent1W1r3dSt4tus00',
      date: new Date('2026-11-12T21:14:05.000Z'),
      author: { handle: 'lain@wired.example', fullHandle: '@lain@wired.example', self: false },
      contentHtml: '<p>She is everywhere now.</p>',
      spoilerText: '',
      boostedBy: null,
      replyTo: null,
      visibility: 'public',
      edited: true,
      counts: { replies: 3, boosts: 2, favourites: 9 },
      mine: { boosted: false, favourited: true, bookmarked: true },
      reactions: [
        { name: '❤️', count: 3, me: true },
        { name: 'lain', count: 1, me: false },
      ],
      media: [],
      emojis: [{ shortcode: 'wired', url: 'https://wired.example/emoji/wired.gif' }],
      sensitive: false,
      poll: null,
      quote: {
        label: null,
        author: { handle: 'alice@other.example', fullHandle: '@alice@other.example' },
        excerpt: 'The wired is all one network.',
      },
    });
  });

  it('maps the emoji list to inline refs on the static image', () => {
    const status = parse(
      wireStatus('1', wireAccount('acc-lain', 'lain', 'lain'), {
        emojis: [
          {
            shortcode: 'lain',
            url: 'https://wired.example/emoji/lain.gif',
            static_url: 'https://wired.example/emoji/lain.png',
          },
        ],
      }),
    );

    expect(postView(status, SIGNED_OUT).emojis).toStrictEqual([
      { shortcode: 'lain', url: 'https://wired.example/emoji/lain.png' },
    ]);
  });

  it('keeps the host in a remote acct', () => {
    const status = parse(wireStatus('2', wireAccount('acc-alice', 'alice', 'alice@other.example')));

    expect(postView(status, SIGNED_OUT).author).toStrictEqual({
      handle: 'alice@other.example',
      fullHandle: '@alice@other.example',
      self: false,
    });
  });

  it('shows the original and names the booster on a boost', () => {
    const original = wireStatus('orig', wireAccount('acc-alice', 'alice', 'alice@other.example'), {
      created_at: '2026-11-11T17:02:00.000Z',
      content: '<p>the original words</p>',
      spoiler_text: 'cw on the original',
    });
    const boost = parse(
      wireStatus('boost-1', wireAccount('acc-bob', 'bob', 'bob'), {
        created_at: '2026-11-12T09:00:00.000Z',
        content: '<p>copied words</p>',
        spoiler_text: 'cw on the boost',
        reblog: original,
      }),
    );

    expect(postView(boost, SIGNED_OUT)).toStrictEqual({
      id: 'orig',
      date: new Date('2026-11-11T17:02:00.000Z'),
      author: { handle: 'alice@other.example', fullHandle: '@alice@other.example', self: false },
      contentHtml: '<p>the original words</p>',
      spoilerText: 'cw on the original',
      boostedBy: { handle: 'bob', fullHandle: '@bob@wired.example' },
      ...QUIET,
    });
  });

  it('flags the original author as self, not the booster', () => {
    const boost = parse(
      wireStatus('boost-1', wireAccount('acc-bob', 'bob', 'bob'), {
        reblog: wireStatus('orig', wireAccount('acc-alice', 'alice', 'alice@other.example')),
      }),
    );

    expect(postView(boost, { origin: ORIGIN, accountId: 'acc-alice' }).author.self).toBe(true);
    expect(postView(boost, { origin: ORIGIN, accountId: 'acc-bob' }).author.self).toBe(false);
  });

  it('flags the author when they are the viewer', () => {
    const status = parse(wireStatus('1', wireAccount('acc-lain', 'lain', 'lain')));

    expect(postView(status, { origin: ORIGIN, accountId: 'acc-lain' }).author.self).toBe(true);
    expect(postView(status, { origin: ORIGIN, accountId: 'acc-other' }).author.self).toBe(false);
  });

  it('never flags the author when nobody is signed in', () => {
    const status = parse(wireStatus('1', wireAccount('acc-lain', 'lain', 'lain')));

    expect(postView(status, SIGNED_OUT).author.self).toBe(false);
  });
});
