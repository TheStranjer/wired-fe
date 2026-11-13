/**
 * Account read endpoints over the shared MSW server: each GET's path and
 * query, verify's dropped source block and its 401, percent-encoded ids,
 * lookup's leading @, statuses' true-only flags and Page wrap, and
 * relationships' repeated id[] and the empty id list that requests nothing.
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import {
  accountStatuses,
  getAccount,
  lookupAccount,
  relationships,
  verifyCredentials,
} from './accountRead';
import { type Result, ok } from '../../lib/result';
import { server } from '../../test/server';
import type { ApiError } from '../errors';
import { AccountSchema } from '../schemas/account';
import { RelationshipSchema } from '../schemas/relationship';
import { StatusSchema } from '../schemas/status';
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
  note: '<p>Close the world. Open the nExt.</p>',
  url: 'https://wired.example/users/lain',
  avatar: 'https://wired.example/avi.png',
  header: 'https://wired.example/banner.png',
  followers_count: 42,
  following_count: 17,
  statuses_count: 12,
};

/** The schema's reading of {@link ACCOUNT_WIRE}: what the endpoints return. */
const ACCOUNT = v.parse(AccountSchema, ACCOUNT_WIRE);

/** The minimal status a backend sends, and the schema's reading of it. */
const STATUS_WIRE = {
  id: '1',
  uri: 'https://wired.example/posts/1',
  created_at: '2026-11-12T18:00:00.000Z',
  account: ACCOUNT_WIRE,
  content: '<p>Good morning.</p>',
  visibility: 'public',
  replies_count: 0,
  reblogs_count: 0,
  favourites_count: 0,
};

const STATUS = v.parse(StatusSchema, STATUS_WIRE);

/** The schema's reading of `{ id: '1' }`: every relationship default. */
const RELATIONSHIP = v.parse(RelationshipSchema, { id: '1' });

/** The error a failed result carries, failing the test when it succeeded. */
function failureOf(result: Result<unknown, ApiError>): ApiError {
  if (result.ok) {
    expect.fail('expected the call to fail');
  }
  return result.error;
}

describe(verifyCredentials, () => {
  it('gets the session account and drops the source block', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/verify_credentials`, ({ request }) => {
        const url = new URL(request.url);

        expect(request.headers.get('Authorization')).toBe('Bearer secret');
        expect(url.pathname).toBe('/api/v1/accounts/verify_credentials');
        expect(url.search).toBe('');

        return HttpResponse.json({ ...ACCOUNT_WIRE, source: { note: '' } });
      }),
    );

    const result = await verifyCredentials(SESSION);

    expect(result).toStrictEqual(ok(ACCOUNT));
  });

  it('reports a 401 as its http error', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/verify_credentials`, () => {
        return HttpResponse.json({ error: 'no token' }, { status: 401 });
      }),
    );

    const result = await verifyCredentials(SESSION, SIGNAL);

    expect(failureOf(result)).toStrictEqual({ kind: 'http', status: 401, message: 'no token' });
  });
});

describe(getAccount, () => {
  it('gets one account by id with no query', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/109`, ({ request }) => {
        const url = new URL(request.url);

        expect(url.pathname).toBe('/api/v1/accounts/109');
        expect(url.search).toBe('');

        return HttpResponse.json(ACCOUNT_WIRE);
      }),
    );

    const result = await getAccount(SESSION, '109');

    expect(result).toStrictEqual(ok(ACCOUNT));
  });

  it('percent-encodes an id with a slash into one path segment', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/:id`, ({ request }) => {
        expect(new URL(request.url).pathname).toBe('/api/v1/accounts/a%2Fb');

        return HttpResponse.json(ACCOUNT_WIRE);
      }),
    );

    const result = await getAccount(SESSION, 'a/b', SIGNAL);

    expect(result).toStrictEqual(ok(ACCOUNT));
  });
});

describe(lookupAccount, () => {
  it('asks for a remote acct by query', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/lookup`, ({ request }) => {
        const url = new URL(request.url);

        expect(url.pathname).toBe('/api/v1/accounts/lookup');
        expect(url.searchParams.get('acct')).toBe('lain@wired.example');

        return HttpResponse.json(ACCOUNT_WIRE);
      }),
    );

    const result = await lookupAccount(SESSION, 'lain@wired.example');

    expect(result).toStrictEqual(ok(ACCOUNT));
  });

  it('strips a leading @', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/lookup`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('acct')).toBe('lain');

        return HttpResponse.json(ACCOUNT_WIRE);
      }),
    );

    const result = await lookupAccount(SESSION, '@lain', SIGNAL);

    expect(result).toStrictEqual(ok(ACCOUNT));
  });
});

describe(accountStatuses, () => {
  it('sends the page query and only the true flags, and returns the page', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/109/statuses`, ({ request }) => {
        const url = new URL(request.url);

        expect(url.searchParams.get('max_id')).toBe('5');
        expect(url.searchParams.get('limit')).toBe('20');
        expect(url.searchParams.get('exclude_replies')).toBe('true');
        expect(url.searchParams.get('pinned')).toBe('true');

        return HttpResponse.json([STATUS_WIRE]);
      }),
    );

    const result = await accountStatuses(
      SESSION,
      '109',
      { page: { cursor: { max_id: '5' }, limit: 20 }, excludeReplies: true, pinned: true },
      SIGNAL,
    );

    expect(result).toStrictEqual({
      ok: true,
      value: { items: [STATUS], links: { next: null, prev: null } },
    });
  });

  it('omits flags that are not true and reports a bad body as a parse error', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/109/statuses`, ({ request }) => {
        const url = new URL(request.url);

        expect(url.search).toBe('');
        expect(url.searchParams.has('exclude_replies')).toBe(false);
        expect(url.searchParams.has('pinned')).toBe(false);

        return HttpResponse.json({ statuses: [] });
      }),
    );

    const result = await accountStatuses(SESSION, '109', {
      excludeReplies: false,
      pinned: false,
    });

    expect(failureOf(result).kind).toBe('parse');
  });
});

describe(relationships, () => {
  it('sends one id[] per id and returns the parsed list', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/relationships`, ({ request }) => {
        const url = new URL(request.url);

        expect(url.pathname).toBe('/api/v1/accounts/relationships');
        expect(url.searchParams.getAll('id[]')).toStrictEqual(['1', '2']);
        expect(url.searchParams.has('id')).toBe(false);

        return HttpResponse.json([{ id: '1' }, { id: '2', following: true }]);
      }),
    );

    await relationships(SESSION, ['1', '2']); // also run the no-signal branch
    const result = await relationships(SESSION, ['1', '2'], SIGNAL);

    expect(result).toStrictEqual(ok([RELATIONSHIP, { ...RELATIONSHIP, id: '2', following: true }]));
  });

  it('answers an empty list without sending a request', async () => {
    // No handler is registered: any request would fail this test.
    const result = await relationships(SESSION, []);

    expect(result).toStrictEqual(ok([]));
  });
});
