/**
 * Tests for the reply draft: it answers the status by id and carries its
 * content warning; it prefixes `@<acct> ` for the author and every mention
 * in order, once each, skipping the reader's own account (in any case) and
 * anyone the typed text already names (in any case); and it keeps the
 * audience of a direct, private or unlisted post while a public or local
 * one leaves the reader's default to fill.
 */
import { describe, expect, it } from 'vitest';

import { replyDraft, replyFields } from './replyDraft';
import type { Status, Visibility } from '../api/schemas/status';
import { TEST_DATE, status } from '../test/fixtures';

/** Nine: the author the tests answer, as the status schema reads her. */
const NINE_WIRE = {
  id: '9',
  username: 'nine',
  acct: 'nine@pleroma.example',
  display_name: 'Nine',
  created_at: TEST_DATE,
  note: '',
  url: 'https://pleroma.example/@nine',
  avatar: 'https://pleroma.example/avi.png',
  header: 'https://pleroma.example/banner.png',
  followers_count: 0,
  following_count: 0,
  statuses_count: 0,
};

/** The mention wire objects alice and bob arrive as. */
function mentionOf(name: string): { id: string; username: string; acct: string; url: string } {
  return {
    id: name,
    username: name,
    acct: `${name}@wired.example`,
    url: `https://wired.example/@${name}`,
  };
}

/** Seven, posted by nine, mentioning alice and bob. */
function byNine(extras: Record<string, unknown> = {}): Status {
  return status('7', {
    account: NINE_WIRE,
    mentions: [mentionOf('alice'), mentionOf('bob')],
    ...extras,
  });
}

describe(replyDraft, () => {
  it('answers the status and names its author and mentions, once each', () => {
    const post = byNine({ mentions: [mentionOf('alice'), mentionOf('bob'), mentionOf('alice')] });

    expect(replyDraft(post, 'lain@wired.example', 'close the world')).toStrictEqual({
      text: '@nine@pleroma.example @alice@wired.example @bob@wired.example close the world',
      spoilerText: '',
      inReplyToId: '7',
    });
  });

  it('skips the author when it is the reader, whichever case names them', () => {
    const mine = status('7');

    expect(replyDraft(mine, 'LAIN@wired.EXAMPLE', 'present day')).toStrictEqual({
      text: 'present day',
      spoilerText: '',
      inReplyToId: '7',
    });
  });

  it('skips anyone the typed text already names, in any case', () => {
    const post = byNine();

    expect(replyDraft(post, 'lain@wired.example', '@Nine@Pleroma.Example, sure')).toStrictEqual({
      text: '@alice@wired.example @bob@wired.example @Nine@Pleroma.Example, sure',
      spoilerText: '',
      inReplyToId: '7',
    });
  });

  it('keeps the audience of a direct, private or unlisted post', () => {
    for (const visibility of ['direct', 'private', 'unlisted'] as const) {
      expect(replyDraft(byNine({ visibility }), 'lain@wired.example', 'hush')).toStrictEqual({
        text: '@nine@pleroma.example @alice@wired.example @bob@wired.example hush',
        spoilerText: '',
        visibility,
        inReplyToId: '7',
      });
    }
  });

  it('leaves a public or local post to the default audience', () => {
    for (const visibility of ['public', 'local'] as const) {
      expect(replyDraft(byNine({ visibility }), 'lain@wired.example', 'hello')).toStrictEqual({
        text: '@nine@pleroma.example @alice@wired.example @bob@wired.example hello',
        spoilerText: '',
        inReplyToId: '7',
      });
    }
  });

  it('carries the content warning of the post answered', () => {
    const post = byNine({ spoiler_text: 'lain spoilers' });

    expect(replyDraft(post, 'lain@wired.example', 'she is everywhere')).toStrictEqual({
      text: '@nine@pleroma.example @alice@wired.example @bob@wired.example she is everywhere',
      spoilerText: 'lain spoilers',
      inReplyToId: '7',
    });
  });
});

describe(replyFields, () => {
  const own = (defaultVisibility: Visibility): Parameters<typeof replyFields>[1] => ({
    ownAcct: 'lain@wired.example',
    accountKey: 'https://wired.example#1',
    defaultVisibility,
  });

  it('holds the mentions, the warning, the post and its line’s account', () => {
    const post = byNine({ spoiler_text: 'lain spoilers' });

    expect(replyFields(post, own('public'))).toStrictEqual({
      text: '@nine@pleroma.example @alice@wired.example @bob@wired.example ',
      spoiler: 'lain spoilers',
      visibility: 'public',
      inReplyTo: { status: post, accountKey: 'https://wired.example#1' },
    });
  });

  it('leaves the text empty when the reply has nobody to name', () => {
    const post = status('7', { account: { ...NINE_WIRE, acct: 'lain@wired.example' } });

    expect(replyFields(post, own('public')).text).toBe('');
  });

  it('takes the post’s audience when it is narrower than the default', () => {
    expect(replyFields(byNine({ visibility: 'direct' }), own('public')).visibility).toBe('direct');
    expect(replyFields(byNine({ visibility: 'private' }), own('unlisted')).visibility).toBe(
      'private',
    );
  });

  it('takes the default when it is narrower than the post’s audience', () => {
    expect(replyFields(byNine({ visibility: 'public' }), own('private')).visibility).toBe(
      'private',
    );
    expect(replyFields(byNine({ visibility: 'public' }), own('local')).visibility).toBe('local');
    expect(replyFields(byNine({ visibility: 'local' }), own('public')).visibility).toBe('local');
  });
});
