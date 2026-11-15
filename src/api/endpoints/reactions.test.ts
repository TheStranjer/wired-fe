/**
 * The emoji reaction endpoints over the shared MSW server: the PUT of `react`
 * and the DELETE of `unreact` on the same encoded path, answering the status
 * with its updated `pleroma.emoji_reactions`, unknown keys dropped by the
 * shared schema; the id and the emoji each kept inside one percent-encoded
 * segment; and a post that is not there reported as the 404's http error.
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { react, unreact } from './reactions';
import { type Result, ok } from '../../lib/result';
import { server } from '../../test/server';
import type { ApiError } from '../errors';
import { StatusSchema } from '../schemas/status';
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

/** The minimal status a backend sends, with an extra key to drop. */
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
  card: null,
};

const STATUS = v.parse(StatusSchema, STATUS_WIRE);

/** {@link STATUS_WIRE} answering with one fire reaction this account sent. */
const REACTED_WIRE = {
  ...STATUS_WIRE,
  pleroma: { emoji_reactions: [{ name: '🔥', count: 1, me: true }] },
};

/** {@link REACTED_WIRE} as the shared schema reads it. */
const REACTED = v.parse(StatusSchema, REACTED_WIRE);

/** The error a failed result carries, failing the test when it succeeded. */
function failureOf(result: Result<unknown, ApiError>): ApiError {
  if (result.ok) {
    expect.fail('expected the call to fail');
  }
  return result.error;
}

describe(react, () => {
  it('PUTs the encoded reaction path and returns the updated status', async () => {
    server.use(
      http.put(`${ORIGIN}/api/v1/pleroma/statuses/:id/reactions/:emoji`, ({ request }) => {
        const url = new URL(request.url);

        expect(request.method).toBe('PUT');
        expect(request.headers.get('Authorization')).toBe('Bearer secret');
        expect(decodeURIComponent(url.pathname)).toBe('/api/v1/pleroma/statuses/1/reactions/🔥');
        expect(url.pathname).toBe('/api/v1/pleroma/statuses/1/reactions/%F0%9F%94%A5');

        return HttpResponse.json(REACTED_WIRE);
      }),
    );

    const result = await react(SESSION, '1', '🔥');

    expect(result).toStrictEqual(ok(REACTED));
  });

  it('keeps the id and the emoji each inside one encoded path segment', async () => {
    server.use(
      http.put(`${ORIGIN}/api/v1/pleroma/statuses/:id/reactions/:emoji`, ({ request }) => {
        expect(new URL(request.url).pathname).toBe('/api/v1/pleroma/statuses/a%2Fb/reactions/blob');

        return HttpResponse.json(REACTED_WIRE);
      }),
    );

    const result = await react(SESSION, 'a/b', 'blob');

    expect(result).toStrictEqual(ok(REACTED));
  });

  it('reports a 404 as its http error', async () => {
    server.use(
      http.put(`${ORIGIN}/api/v1/pleroma/statuses/:id/reactions/:emoji`, () => {
        return HttpResponse.json({ error: 'Record not found' }, { status: 404 });
      }),
    );

    const result = await react(SESSION, 'gone', '🔥');

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 404,
      message: 'Record not found',
    });
  });
});

describe(unreact, () => {
  it('DELETEs the same path and returns the status without the reaction', async () => {
    server.use(
      http.delete(`${ORIGIN}/api/v1/pleroma/statuses/:id/reactions/:emoji`, ({ request }) => {
        expect(request.method).toBe('DELETE');
        expect(request.headers.get('Authorization')).toBe('Bearer secret');
        expect(new URL(request.url).pathname).toBe(
          '/api/v1/pleroma/statuses/1/reactions/%F0%9F%94%A5',
        );

        return HttpResponse.json(STATUS_WIRE);
      }),
    );

    const result = await unreact(SESSION, '1', '🔥');

    expect(result).toStrictEqual(ok(STATUS));
  });

  it('keeps a shortcode with a colon-free name inside one segment', async () => {
    server.use(
      http.delete(`${ORIGIN}/api/v1/pleroma/statuses/:id/reactions/:emoji`, ({ request }) => {
        expect(new URL(request.url).pathname).toBe(
          '/api/v1/pleroma/statuses/1/reactions/lain_waves',
        );

        return HttpResponse.json(STATUS_WIRE);
      }),
    );

    const result = await unreact(SESSION, '1', 'lain_waves');

    expect(result).toStrictEqual(ok(STATUS));
  });

  it('reports a 404 as its http error', async () => {
    server.use(
      http.delete(`${ORIGIN}/api/v1/pleroma/statuses/:id/reactions/:emoji`, () => {
        return HttpResponse.json({ error: 'Record not found' }, { status: 404 });
      }),
    );

    const result = await unreact(SESSION, 'gone', '🔥');

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 404,
      message: 'Record not found',
    });
  });
});
