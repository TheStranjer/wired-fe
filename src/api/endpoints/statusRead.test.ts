/**
 * The status read endpoints over the shared MSW server: the GET of the
 * encoded status path returns the parsed post and a 404 becomes its http
 * error, and the GET of the context path returns the ancestors and
 * descendants of the thread in the order the server sends them. Both calls
 * run with and without a signal so the cancel path is wired as well.
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { getContext, getStatus } from './statusRead';
import { type Result, ok } from '../../lib/result';
import { server } from '../../test/server';
import type { ApiError } from '../errors';
import { ContextSchema } from '../schemas/context';
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

/** The post above the focus in the thread, replying to one we do not fetch. */
const ANCESTOR_WIRE = {
  ...STATUS_WIRE,
  id: '10',
  uri: 'https://wired.example/posts/10',
  content: '<p>Ladies and gentlemen, today it finally snowed.</p>',
  in_reply_to_id: '9',
};

/** The reply below the focus in the thread. */
const DESCENDANT_WIRE = {
  ...STATUS_WIRE,
  id: '20',
  uri: 'https://wired.example/posts/20',
  content: '<p>Let me guess someone said something stupid.</p>',
  in_reply_to_id: '1',
};

/** The schema's reading of the thread: the post flanked by one above, one below. */
const CONTEXT = v.parse(ContextSchema, {
  ancestors: [ANCESTOR_WIRE],
  descendants: [DESCENDANT_WIRE],
});

/** The error a failed result carries, failing the test when it succeeded. */
function failureOf(result: Result<unknown, ApiError>): ApiError {
  if (result.ok) {
    expect.fail('expected the call to fail');
  }
  return result.error;
}

describe(getStatus, () => {
  it('GETs the status path and returns the parsed status', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/statuses/1`, ({ request }) => {
        const url = new URL(request.url);

        expect(request.method).toBe('GET');
        expect(request.headers.get('Authorization')).toBe('Bearer secret');
        expect(url.pathname).toBe('/api/v1/statuses/1');
        expect(url.search).toBe('');

        return HttpResponse.json(STATUS_WIRE);
      }),
    );

    const result = await getStatus(SESSION, '1', SIGNAL);

    expect(result).toStrictEqual(ok(STATUS));
  });

  it('keeps an id with a slash inside one encoded path segment', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/statuses/:id`, ({ request }) => {
        expect(new URL(request.url).pathname).toBe('/api/v1/statuses/a%2Fb');

        return HttpResponse.json(STATUS_WIRE);
      }),
    );

    const result = await getStatus(SESSION, 'a/b'); // also run the no-signal branch

    expect(result).toStrictEqual(ok(STATUS));
  });

  it('reports a 404 as its http error', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/statuses/1`, () => {
        return HttpResponse.json({ error: 'Record not found' }, { status: 404 });
      }),
    );

    const result = await getStatus(SESSION, '1');

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 404,
      message: 'Record not found',
    });
  });
});

describe(getContext, () => {
  it('GETs the context path and returns ancestors and descendants', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/statuses/1/context`, ({ request }) => {
        const url = new URL(request.url);

        expect(request.method).toBe('GET');
        expect(request.headers.get('Authorization')).toBe('Bearer secret');
        expect(url.pathname).toBe('/api/v1/statuses/1/context');
        expect(url.search).toBe('');

        return HttpResponse.json({
          ancestors: [ANCESTOR_WIRE],
          descendants: [DESCENDANT_WIRE],
        });
      }),
    );

    await getContext(SESSION, '1'); // also run the no-signal branch
    const result = await getContext(SESSION, '1', SIGNAL);

    expect(result).toStrictEqual(ok(CONTEXT));
  });

  it('reports a 404 as its http error', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/statuses/1/context`, () => {
        return HttpResponse.json({ error: 'Record not found' }, { status: 404 });
      }),
    );

    const result = await getContext(SESSION, '1');

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 404,
      message: 'Record not found',
    });
  });
});
