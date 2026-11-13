/**
 * The status action endpoints over the shared MSW server: one table-driven
 * test per action checking the POST path and the parsed status returned, the
 * percent-encoded id kept inside one path segment, reblog's boost wrapper
 * answer with the original nested in it, and a 404 reported as its http
 * error.
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { type StatusAction, statusAction } from './statusActions';
import { type Result, ok } from '../../lib/result';
import { server } from '../../test/server';
import type { ApiError } from '../errors';
import { StatusSchema } from '../schemas/status';
import type { ApiSession } from '../session';

const ORIGIN = 'https://wired.example';

const SESSION: ApiSession = { origin: ORIGIN, token: 'secret' };

/** The eight actions, as the endpoint's own union names them. */
const ACTIONS: readonly StatusAction[] = [
  'favourite',
  'unfavourite',
  'reblog',
  'unreblog',
  'bookmark',
  'unbookmark',
  'pin',
  'unpin',
];

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

/** The error a failed result carries, failing the test when it succeeded. */
function failureOf(result: Result<unknown, ApiError>): ApiError {
  if (result.ok) {
    expect.fail('expected the call to fail');
  }
  return result.error;
}

describe(statusAction, () => {
  it.each(ACTIONS)('POSTs the %s path and returns the parsed status', async (action) => {
    server.use(
      http.post(`${ORIGIN}/api/v1/statuses/1/${action}`, ({ request }) => {
        const url = new URL(request.url);

        expect(request.headers.get('Authorization')).toBe('Bearer secret');
        expect(url.pathname).toBe(`/api/v1/statuses/1/${action}`);

        return HttpResponse.json(STATUS_WIRE);
      }),
    );

    const result = await statusAction(SESSION, '1', action);

    expect(result).toStrictEqual(ok(STATUS));
  });

  it('keeps an id with a slash inside one encoded path segment', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/statuses/:id/favourite`, ({ request }) => {
        expect(new URL(request.url).pathname).toBe('/api/v1/statuses/a%2Fb/favourite');

        return HttpResponse.json(STATUS_WIRE);
      }),
    );

    const result = await statusAction(SESSION, 'a/b', 'favourite');

    expect(result).toStrictEqual(ok(STATUS));
  });

  it('returns reblog boost wrapper with the original status nested in it', async () => {
    const wrapper = { ...STATUS_WIRE, id: '2', reblog: STATUS_WIRE };

    server.use(
      http.post(`${ORIGIN}/api/v1/statuses/1/reblog`, () => {
        return HttpResponse.json(wrapper);
      }),
    );

    const result = await statusAction(SESSION, '1', 'reblog');

    expect(result).toStrictEqual(ok({ ...STATUS, id: '2', reblog: STATUS }));
  });

  it('reports a 404 as its http error', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/statuses/1/favourite`, () => {
        return HttpResponse.json({ error: 'Record not found' }, { status: 404 });
      }),
    );

    const result = await statusAction(SESSION, '1', 'favourite');

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 404,
      message: 'Record not found',
    });
  });
});
