/**
 * The search endpoint over the shared MSW server: the request always carries
 * `q` and each optional parameter only when set; the three lists come back
 * through the shared schemas, with extras like Pleroma's hashtag `history`
 * dropped and a missing list read as empty; a cancelled request answers the
 * aborted error and a 401 the http one. {@link shouldResolve} accepts acct
 * handles and http(s) URLs and refuses plain words and `#tag`s.
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { type SearchType, search, shouldResolve } from './search';
import { type Result, err } from '../../lib/result';
import { server } from '../../test/server';
import type { ApiError } from '../errors';
import { type Account, AccountSchema } from '../schemas/account';
import { type Status, StatusSchema } from '../schemas/status';
import { type Tag, TagSchema } from '../schemas/tag';
import type { ApiSession } from '../session';

const ORIGIN = 'https://wired.example';

const SESSION: ApiSession = { origin: ORIGIN, token: 'secret' };

/** The twelve fields every backend sends for an account. */
const ACCOUNT_WIRE = {
  id: '109',
  username: 'lain',
  acct: 'lain@wired.example',
  display_name: 'Lain Iwakura',
  created_at: '2024-03-01T00:00:00.000Z',
  note: '<p>Close the world. Open the nExt.</p>',
  url: 'https://wired.example/users/lain',
  avatar: 'https://wired.example/avi.png',
  header: 'https://wired.example/banner.png',
  followers_count: 42,
  following_count: 17,
  statuses_count: 12,
};

/** The seven required fields of a post, as a backend sends it. */
const STATUS_WIRE = {
  id: '7',
  uri: 'https://wired.example/posts/7',
  created_at: '2026-11-12T21:14:05.000Z',
  account: ACCOUNT_WIRE,
  content: '<p>is anyone there?</p>',
  visibility: 'public',
  replies_count: 0,
  reblogs_count: 0,
  favourites_count: 0,
};

/** A hashtag as v2 answers it, with the search-side empty history. */
const TAG_WIRE = {
  name: 'lain',
  url: 'https://wired.example/tags/lain',
  history: [{ day: '2026-11-12', uses: 3, accounts: 2 }],
};

const ACCOUNT: Account = v.parse(AccountSchema, ACCOUNT_WIRE);

const STATUS: Status = v.parse(StatusSchema, STATUS_WIRE);

/** {@link TAG_WIRE} as the shared schema reads it: `history` dropped. */
const TAG: Tag = v.parse(TagSchema, TAG_WIRE);

/** The full document, all three lists filled. */
const FULL_DOCUMENT = { accounts: [ACCOUNT], statuses: [STATUS], hashtags: [TAG] };

/** A query and whether it is worth asking the instance to resolve it. */
const RESOLVE_CASES: readonly (readonly [query: string, expected: boolean])[] = [
  ['@a@b.example', true],
  ['a@b.example', true],
  ['  lain@wired.example  ', true],
  ['https://x/y', true],
  ['http://wired.example/posts/7', true],
  ['HTTPS://X/Y', true],
  ['lain', false],
  ['#tag', false],
  ['', false],
  ['two words', false],
  ['a@', false],
  ['@', false],
  ['ftp://x/y', false],
];

/** The error a failed result carries, failing the test when it succeeded. */
function failureOf(result: Result<unknown, ApiError>): ApiError {
  if (result.ok) {
    expect.fail('expected the call to fail');
  }
  return result.error;
}

describe(search, () => {
  it('sends only q and returns the three lists normalized', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v2/search`, ({ request }) => {
        const url = new URL(request.url);

        expect(request.method).toBe('GET');
        expect(request.headers.get('Authorization')).toBe('Bearer secret');
        expect(url.search).toBe('?q=lain');

        return HttpResponse.json({
          accounts: [ACCOUNT_WIRE],
          statuses: [STATUS_WIRE],
          hashtags: [TAG_WIRE],
        });
      }),
    );

    const result = await search(SESSION, 'lain', {});

    expect(result).toStrictEqual({ ok: true, value: FULL_DOCUMENT });
  });

  it('sends resolve, type and limit when they are set', async () => {
    const type: SearchType = 'accounts';

    server.use(
      http.get(`${ORIGIN}/api/v2/search`, ({ request }) => {
        expect(Object.fromEntries(new URL(request.url).searchParams)).toStrictEqual({
          q: '@lain@wired.example',
          resolve: 'true',
          type: 'accounts',
          limit: '10',
        });

        return HttpResponse.json({ accounts: [ACCOUNT_WIRE] });
      }),
    );

    const result = await search(SESSION, '@lain@wired.example', {
      resolve: true,
      type,
      limit: 10,
    });

    expect(result).toStrictEqual({
      ok: true,
      value: { accounts: [ACCOUNT], statuses: [], hashtags: [] },
    });
  });

  it('omits resolve when it is false and reads missing lists as empty', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v2/search`, ({ request }) => {
        expect(new URL(request.url).search).toBe('?q=lain&limit=5');

        return HttpResponse.json({});
      }),
    );

    const result = await search(SESSION, 'lain', { resolve: false, limit: 5 });

    expect(result).toStrictEqual({
      ok: true,
      value: { accounts: [], statuses: [], hashtags: [] },
    });
  });

  it('maps an already-aborted signal to the aborted error', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v2/search`, () => {
        return HttpResponse.json({});
      }),
    );

    const controller = new AbortController();
    controller.abort();

    const result = await search(SESSION, 'lain', {}, controller.signal);

    expect(result).toStrictEqual(err({ kind: 'aborted' }));
  });

  it('reports a 401 as its http error', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v2/search`, () => {
        return HttpResponse.json({ error: 'The access token is invalid' }, { status: 401 });
      }),
    );

    const result = await search(SESSION, 'lain', {});

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 401,
      message: 'The access token is invalid',
    });
  });

  it('drops a status missing its account instead of failing the search', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v2/search`, () => {
        return HttpResponse.json({ statuses: [{ id: '7' }] });
      }),
    );

    const result = await search(SESSION, 'lain', {});

    expect(result).toStrictEqual({ ok: true, value: { accounts: [], statuses: [], hashtags: [] } });
  });

  it('reports a statuses list that is not an array as a parse error', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v2/search`, () => {
        return HttpResponse.json({ statuses: { id: '7' } });
      }),
    );

    const result = await search(SESSION, 'lain', {});

    expect(failureOf(result).kind).toBe('parse');
  });
});

describe(shouldResolve, () => {
  it.each(RESOLVE_CASES)('wants resolution for %s: %s', (query, expected) => {
    expect(shouldResolve(query)).toBe(expected);
  });
});
