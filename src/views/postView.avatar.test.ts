/**
 * Tests for the avatar URLs in the post view model: the author's and the
 * booster's, taken from the recorded Wired, Mastodon and Pleroma statuses, with
 * the still falling back to the animated image when a backend sends none.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { postView } from './postView';
import mastodonFixture from '../api/fixtures/status/mastodon.json';
import pleromaFixture from '../api/fixtures/status/pleroma.json';
import wiredFixture from '../api/fixtures/status/wired.json';
import { StatusSchema } from '../api/schemas/status';
import type { Status } from '../api/schemas/status';

const SIGNED_OUT = { origin: 'https://wired.example', accountId: null };

/** Parses {@link input} as a Status, throwing on invalid input. */
function parse(input: unknown): Status {
  const result = v.safeParse(StatusSchema, input);
  if (!result.success) {
    throw new Error(`unexpected parse failure: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

describe('postView avatars', () => {
  it('carries the Wired author avatar and its still', () => {
    const { author } = postView(parse(wiredFixture), SIGNED_OUT);

    expect(author.avatar).toStrictEqual({
      src: 'https://wired.example/avatars/lain.png',
      staticSrc: 'https://wired.example/avatars/lain.png',
    });
  });

  it('carries the Mastodon author avatar, the still defaulting to it', () => {
    const { author } = postView(parse(mastodonFixture), SIGNED_OUT);

    expect(author.avatar).toStrictEqual({
      src: 'https://mastodon.example/avatars/missing.png',
      staticSrc: 'https://mastodon.example/avatars/missing.png',
    });
  });

  it('carries the Pleroma author avatar', () => {
    const { author } = postView(parse(pleromaFixture), SIGNED_OUT);

    expect(author.avatar.src).toBe('https://pleroma.example/images/avatars/original/missing.png');
  });

  it('keeps a distinct still image apart from the animated one', () => {
    const status = parse({
      ...wiredFixture,
      account: {
        ...wiredFixture.account,
        avatar: 'https://wired.example/avatars/lain.gif',
        avatar_static: 'https://wired.example/avatars/lain-0.png',
      },
    });

    expect(postView(status, SIGNED_OUT).author.avatar).toStrictEqual({
      src: 'https://wired.example/avatars/lain.gif',
      staticSrc: 'https://wired.example/avatars/lain-0.png',
    });
  });

  it('gives a boost the original author and the booster each their own avatar', () => {
    const boost = parse({
      ...wiredFixture,
      id: 'boost-1',
      reblog: wiredFixture,
      account: {
        ...wiredFixture.account,
        id: 'booster',
        acct: 'booster',
        avatar: 'https://wired.example/avatars/booster.png',
        avatar_static: 'https://wired.example/avatars/booster-0.png',
      },
    });

    const view = postView(boost, SIGNED_OUT);

    expect(view.author.avatar.src).toBe('https://wired.example/avatars/lain.png');
    expect(view.boostedBy?.avatar).toStrictEqual({
      src: 'https://wired.example/avatars/booster.png',
      staticSrc: 'https://wired.example/avatars/booster-0.png',
    });
  });
});
