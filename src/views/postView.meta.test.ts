/**
 * Tests for the metadata half of postView: who a reply answers and what it says
 * when the backend named an account the status never mentions, the five
 * audiences, the counters, the marks the viewer left, the reactions and the
 * edit mark — all of it read from the displayed status, so a boost shows the
 * original's own.
 */

import { describe, expect, it } from 'vitest';

import { postView } from './postView';
import type { Viewer } from './postView';
import type { Status } from '../api/schemas/status';
import { status } from '../test/fixtures';

const SIGNED_OUT: Viewer = { origin: 'https://wired.example', accountId: null };

/** Carol, in the four fields a mention carries. */
const CAROL = {
  id: 'acc-carol',
  username: 'carol',
  acct: 'carol@m.other',
  url: 'https://m.other/@carol',
};

/** A reply to a post the backend names, mentioning {@link mentions}. */
function reply(mentions: readonly unknown[]): Status {
  return status('reply', {
    in_reply_to_id: 'parent',
    in_reply_to_account_id: CAROL.id,
    mentions,
  });
}

describe('postView metadata', () => {
  it('names the account a reply mentions', () => {
    expect(postView(reply([CAROL]), SIGNED_OUT).replyTo).toBe('@carol@m.other');
  });

  it('says a thread when the account it answers is not mentioned', () => {
    expect(postView(reply([]), SIGNED_OUT).replyTo).toBe('a thread');
  });

  it('says a thread when no parent account id came with the reply', () => {
    const orphan = status('reply', { in_reply_to_id: 'parent', mentions: [CAROL] });

    expect(postView(orphan, SIGNED_OUT).replyTo).toBe('a thread');
  });

  it('says nothing about who a post answers when it answers nobody', () => {
    expect(postView(status('a'), SIGNED_OUT).replyTo).toBeNull();
  });

  const AUDIENCES: readonly (readonly [string, string])[] = [
    ['public', 'public'],
    ['unlisted', 'unlisted'],
    ['private', 'private'],
    ['direct', 'direct'],
    ['local', 'local'],
    ['list', 'private'],
  ];

  it.each(AUDIENCES)('keeps the %s audience as %s', (wire, shown) => {
    const post = status('a', { visibility: wire });

    expect(postView(post, SIGNED_OUT).visibility).toBe(shown);
  });

  it('counts replies, boosts and favourites under the row names', () => {
    const post = status('a', { replies_count: 2, reblogs_count: 1, favourites_count: 5 });

    expect(postView(post, SIGNED_OUT).counts).toStrictEqual({
      replies: 2,
      boosts: 1,
      favourites: 5,
    });
  });

  it('reports which marks the viewer has already left', () => {
    const done = status('a', { reblogged: true, favourited: true, bookmarked: true });
    const fresh = status('a');

    expect(postView(done, SIGNED_OUT).mine).toStrictEqual({
      boosted: true,
      favourited: true,
      bookmarked: true,
    });
    expect(postView(fresh, SIGNED_OUT).mine).toStrictEqual({
      boosted: false,
      favourited: false,
      bookmarked: false,
    });
  });

  it('keeps a reaction tally and the image url of a custom emoji', () => {
    const post = status('a', {
      pleroma: {
        emoji_reactions: [
          { name: '🔥', count: 2, me: true, url: 'https://wired.example/emoji/fire.gif' },
          { name: '❤️', count: 1 },
        ],
      },
    });

    expect(postView(post, SIGNED_OUT).reactions).toStrictEqual([
      { name: '🔥', count: 2, me: true, url: 'https://wired.example/emoji/fire.gif' },
      { name: '❤️', count: 1, me: false, url: null },
    ]);
  });

  it('knows an edited post by its edit timestamp', () => {
    const edited = status('a', { edited_at: '2026-11-12T22:00:00.000Z' });

    expect(postView(edited, SIGNED_OUT).edited).toBe(true);
    expect(postView(status('a'), SIGNED_OUT).edited).toBe(false);
  });

  it('reads the metadata of the original, never of the boost around it', () => {
    const original = status('orig', {
      in_reply_to_id: 'parent',
      in_reply_to_account_id: CAROL.id,
      mentions: [CAROL],
      visibility: 'direct',
      edited_at: '2026-11-12T22:00:00.000Z',
      replies_count: 4,
      reblogs_count: 5,
      favourites_count: 6,
      reblogged: true,
      favourited: true,
      bookmarked: true,
    });
    // A nested status parses from the wire, and on the wire reactions ride
    // inside `pleroma`, the block the parsed shape has already unfolded.
    const boost = status('boost', {
      reblog: { ...original, pleroma: { emoji_reactions: [{ name: '🔥', count: 2, me: true }] } },
    });

    const view = postView(boost, SIGNED_OUT);

    expect(view.replyTo).toBe('@carol@m.other');
    expect([view.visibility, view.edited]).toStrictEqual(['direct', true]);
    expect(view.counts).toStrictEqual({ replies: 4, boosts: 5, favourites: 6 });
    expect(view.mine).toStrictEqual({ boosted: true, favourited: true, bookmarked: true });
    expect(view.reactions).toStrictEqual([{ name: '🔥', count: 2, me: true, url: null }]);
  });
});
