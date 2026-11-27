/**
 * Tests for the post link helpers: a post under the account's instance origin,
 * by uri or by url, gets WiredFE's `#/notice/<id>` permalink on the current
 * page; any other post, a look-alike host included, gets none.
 */
import { describe, expect, it } from 'vitest';

import { type PermalinkPage, currentPage, localPermalink, statusLink } from './statusLink';
import type { StoredAccount } from '../accounts/accountStore';
import { buildConfig } from '../config/config';
import { status } from '../test/fixtures';

const ORIGIN = 'https://wired.example';

/** The account whose instance is {@link ORIGIN}. */
const LAIN: StoredAccount = {
  key: `${ORIGIN}#1`,
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'token',
  refreshToken: null,
  expiresAt: null,
};

/** The page WiredFE is served from. */
const PAGE: PermalinkPage = {
  origin: 'https://fe.example',
  pathname: '/app/',
  mode: 'same-origin',
};

/** A post whose uri and url are both off the account's instance. */
const REMOTE = { uri: 'https://pleroma.example/n/7', url: 'https://pleroma.example/7' };

describe(localPermalink, () => {
  it('answers the notice route for a post whose uri is local', () => {
    const local = status('7', { uri: `${ORIGIN}/n/7`, url: null });

    expect(localPermalink(local, LAIN, PAGE)).toBe('https://fe.example/app/#/notice/7');
  });

  it('answers the notice route for a post whose url is local', () => {
    const local = status('7', { ...REMOTE, url: `${ORIGIN}/notice/7` });

    expect(localPermalink(local, LAIN, PAGE)).toBe('https://fe.example/app/#/notice/7');
  });

  it('answers null for a remote post', () => {
    expect(localPermalink(status('7', REMOTE), LAIN, PAGE)).toBeNull();
  });

  it('answers null for a post with no url on another host', () => {
    expect(localPermalink(status('7', { ...REMOTE, url: null }), LAIN, PAGE)).toBeNull();
  });

  it('answers null for an origin that only starts with the same text', () => {
    const evil = status('7', {
      uri: 'https://wired.example.evil/n/7',
      url: 'https://wired.example.evil/7',
    });

    expect(localPermalink(evil, LAIN, PAGE)).toBeNull();
  });

  it('answers null without an account', () => {
    expect(localPermalink(status('7'), null, PAGE)).toBeNull();
  });
});

describe('localPermalink by instance mode', () => {
  const local = status('7', { uri: `${ORIGIN}/n/7`, url: null });

  it.each(['list', 'open'] as const)('names the instance in a %s build', (mode) => {
    expect(localPermalink(local, LAIN, { ...PAGE, mode })).toBe(
      'https://fe.example/app/#/wired.example/notice/7',
    );
  });

  it.each(['same-origin', 'fixed'] as const)('keeps the short form in a %s build', (mode) => {
    expect(localPermalink(local, LAIN, { ...PAGE, mode })).toBe(
      'https://fe.example/app/#/notice/7',
    );
  });

  it('names a local instance with its port', () => {
    const dev = { ...LAIN, origin: 'http://localhost:4000' };
    const post = status('9', { uri: 'http://localhost:4000/n/9', url: null });

    expect(localPermalink(post, dev, { ...PAGE, mode: 'open' })).toBe(
      'https://fe.example/app/#/localhost:4000/notice/9',
    );
  });
});

describe(currentPage, () => {
  it('is the address bar and the build mode', () => {
    expect(currentPage()).toStrictEqual({
      origin: window.location.origin,
      pathname: window.location.pathname,
      mode: buildConfig.instances.mode,
    });
  });
});

describe(statusLink, () => {
  it('prefers the url and falls back to the uri', () => {
    expect(statusLink(status('7', REMOTE))).toBe('https://pleroma.example/7');
    expect(statusLink(status('7', { ...REMOTE, url: null }))).toBe('https://pleroma.example/n/7');
  });
});
