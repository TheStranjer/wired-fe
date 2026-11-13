/**
 * The poll vote endpoint over the shared MSW server: the POST of the encoded
 * votes path carries the JSON `{ choices }` body of option indexes and returns
 * the updated poll as its new voter sees it, unknown keys dropped by the
 * shared schema; a second ballot is the 422 the server names, and a poll that
 * is not there at all the 404.
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { votePoll } from './polls';
import { type Result, ok } from '../../lib/result';
import { server } from '../../test/server';
import type { ApiError } from '../errors';
import { type Poll, PollSchema } from '../schemas/poll';
import type { ApiSession } from '../session';

const ORIGIN = 'https://wired.example';

const SESSION: ApiSession = { origin: ORIGIN, token: 'secret' };

/** The poll as the server answers a ballot, with an extra key to drop. */
const POLL_WIRE = {
  id: '0194a6b2-7e3f-7abc-9def-0123456789ab',
  expires_at: '2026-11-20T12:00:00.000Z',
  expired: false,
  multiple: false,
  votes_count: 43,
  voters_count: 43,
  options: [
    { title: 'Tabs', votes_count: 26 },
    { title: 'Spaces', votes_count: 17 },
  ],
  voted: true,
  own_votes: [0],
  emojis: [],
  cached_web_tallies: false,
};

/** {@link POLL_WIRE} as the shared schema reads it. */
const POLL: Poll = v.parse(PollSchema, POLL_WIRE);

/** The error a failed result carries, failing the test when it succeeded. */
function failureOf(result: Result<unknown, ApiError>): ApiError {
  if (result.ok) {
    expect.fail('expected the call to fail');
  }
  return result.error;
}

describe(votePoll, () => {
  it('POSTs the JSON choices body and returns the updated poll', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/polls/${POLL.id}/votes`, async ({ request }) => {
        expect(request.method).toBe('POST');
        expect(request.headers.get('Authorization')).toBe('Bearer secret');
        expect(request.headers.get('Content-Type')).toBe('application/json');

        const body: unknown = await request.json();

        expect(body).toStrictEqual({ choices: [0] });

        return HttpResponse.json(POLL_WIRE);
      }),
    );

    const result = await votePoll(SESSION, POLL.id, [0]);

    expect(result).toStrictEqual(ok(POLL));
  });

  it('sends every index of a multiple-choice ballot in order', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/polls/:id/votes`, async ({ request }) => {
        const body: unknown = await request.json();

        expect(body).toStrictEqual({ choices: [2, 0] });

        return HttpResponse.json({ ...POLL_WIRE, multiple: true, own_votes: [2, 0] });
      }),
    );

    const result = await votePoll(SESSION, POLL.id, [2, 0]);

    expect(result).toStrictEqual(ok({ ...POLL, multiple: true, own_votes: [2, 0] }));
  });

  it('keeps an id with a slash inside one encoded path segment', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/polls/:id/votes`, ({ request }) => {
        expect(new URL(request.url).pathname).toBe('/api/v1/polls/a%2Fb/votes');

        return HttpResponse.json(POLL_WIRE);
      }),
    );

    const result = await votePoll(SESSION, 'a/b', [1]);

    expect(result).toStrictEqual(ok(POLL));
  });

  it('reports a second ballot as its 422', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/polls/:id/votes`, () => {
        return HttpResponse.json({ error: 'You have already voted on this poll' }, { status: 422 });
      }),
    );

    const result = await votePoll(SESSION, POLL.id, [0]);

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 422,
      message: 'You have already voted on this poll',
    });
  });

  it('reports an unknown poll as its 404', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/polls/:id/votes`, () => {
        return HttpResponse.json({ error: 'Record not found' }, { status: 404 });
      }),
    );

    const result = await votePoll(SESSION, 'nope', [0]);

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 404,
      message: 'Record not found',
    });
  });
});
