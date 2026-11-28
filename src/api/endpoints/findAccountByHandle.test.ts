/**
 * Tests for findAccountByHandle over the shared MSW server: a lookup that
 * works is returned with no search, a 404 for a `user@host` handle is
 * resolved by an `accounts` search matched on `acct` or `fqn` in any case,
 * and every other outcome (no exact match, a failed search, a name with no
 * host, another lookup error, a session with no token) answers the lookup's
 * own error without a search.
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { findAccountByHandle } from './accountRead';
import { ok } from '../../lib/result';
import { server } from '../../test/server';
import { AccountSchema } from '../schemas/account';
import type { ApiSession } from '../session';

const ORIGIN = 'https://wired.example';

const SESSION: ApiSession = { origin: ORIGIN, token: 'secret' };

/** A never-aborted signal: the request runs with it. */
const SIGNAL = new AbortController().signal;

/** The twelve fields every backend sends for an account. */
const ACCOUNT_WIRE = {
  id: '109',
  username: 'lain',
  acct: 'lain@wired.example',
  display_name: 'Lain Iwakura',
  created_at: '2024-03-01T00:00:00.000Z',
  note: '<p>Close the world.</p>',
  url: 'https://wired.example/users/lain',
  avatar: 'https://wired.example/avi.png',
  header: 'https://wired.example/banner.png',
  followers_count: 42,
  following_count: 17,
  statuses_count: 12,
};

/** The schema's reading of {@link ACCOUNT_WIRE}. */
const ACCOUNT = v.parse(AccountSchema, ACCOUNT_WIRE);

/** An account of a remote instance, the one the searches find. */
const REMOTE_WIRE = { ...ACCOUNT_WIRE, id: '7', username: 'bob', acct: 'bob@remote.example' };

/** What a lookup of a never-seen account answers. */
function notFound(): Response {
  return HttpResponse.json({ error: 'Record not found' }, { status: 404 });
}

/** Serves a 404 lookup and a search answering {@link accounts}; the searches seen are collected. */
function serveSearchFallback(accounts: readonly object[]): URLSearchParams[] {
  const searches: URLSearchParams[] = [];
  server.use(
    http.get(`${ORIGIN}/api/v1/accounts/lookup`, notFound),
    http.get(`${ORIGIN}/api/v2/search`, ({ request }) => {
      searches.push(new URL(request.url).searchParams);
      return HttpResponse.json({ accounts });
    }),
  );
  return searches;
}

describe(findAccountByHandle, () => {
  it('returns a successful lookup and makes no search', async () => {
    const searches = serveSearchFallback([]);
    server.use(http.get(`${ORIGIN}/api/v1/accounts/lookup`, () => HttpResponse.json(ACCOUNT_WIRE)));

    const result = await findAccountByHandle(SESSION, 'lain@wired.example', SIGNAL);

    expect(result).toStrictEqual(ok(ACCOUNT));
    expect(searches).toStrictEqual([]);
  });

  it('resolves a remote handle by search when the lookup is a 404', async () => {
    const searches = serveSearchFallback([ACCOUNT_WIRE, REMOTE_WIRE]);

    const result = await findAccountByHandle(SESSION, 'bob@remote.example');

    expect(result.ok && result.value.id).toBe('7');
    expect(searches).toHaveLength(1);
  });

  it('asks the search to resolve accounts, five at most', async () => {
    const searches = serveSearchFallback([REMOTE_WIRE]);

    await findAccountByHandle(SESSION, 'bob@remote.example');

    expect(Object.fromEntries(searches[0] ?? [])).toStrictEqual({
      q: 'bob@remote.example',
      resolve: 'true',
      type: 'accounts',
      limit: '5',
    });
  });

  it('matches in any case and without the leading @', async () => {
    serveSearchFallback([REMOTE_WIRE]);

    const result = await findAccountByHandle(SESSION, '@Bob@Remote.Example');

    expect(result.ok && result.value.id).toBe('7');
  });

  it('matches by fqn when the acct has no host', async () => {
    serveSearchFallback([{ ...REMOTE_WIRE, acct: 'bob', fqn: 'bob@remote.example' }]);

    const result = await findAccountByHandle(SESSION, 'bob@remote.example');

    expect(result.ok && result.value.id).toBe('7');
  });

  it('answers the original 404 when no result matches exactly', async () => {
    serveSearchFallback([ACCOUNT_WIRE]);

    const result = await findAccountByHandle(SESSION, 'bob@remote.example');

    expect(!result.ok && result.error).toMatchObject({
      kind: 'http',
      status: 404,
      message: 'Record not found',
    });
  });

  it('answers the original 404 when the search itself fails', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/lookup`, notFound),
      http.get(`${ORIGIN}/api/v2/search`, () => HttpResponse.json({}, { status: 500 })),
    );

    const result = await findAccountByHandle(SESSION, 'bob@remote.example');

    expect(!result.ok && result.error).toMatchObject({ kind: 'http', status: 404 });
  });

  it('does not search for a name with no host', async () => {
    const searches = serveSearchFallback([REMOTE_WIRE]);

    const result = await findAccountByHandle(SESSION, 'bob');

    expect(result.ok).toBe(false);
    expect(searches).toStrictEqual([]);
  });

  it('answers any other lookup error unchanged, with no search', async () => {
    const searches = serveSearchFallback([REMOTE_WIRE]);
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/lookup`, () => {
        return HttpResponse.json({ error: 'Boom' }, { status: 500 });
      }),
    );

    const result = await findAccountByHandle(SESSION, 'bob@remote.example');

    expect(!result.ok && result.error).toMatchObject({ kind: 'http', status: 500 });
    expect(searches).toStrictEqual([]);
  });

  it('does not search without a token', async () => {
    const searches = serveSearchFallback([REMOTE_WIRE]);

    const result = await findAccountByHandle({ origin: ORIGIN, token: null }, 'bob@remote.example');

    expect(result.ok).toBe(false);
    expect(searches).toStrictEqual([]);
  });
});
