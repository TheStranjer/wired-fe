/**
 * The status write endpoints over the shared MSW server: create POSTs the
 * snake_case body of the fields that are set, with `Idempotency-Key` and
 * `'local'` visibility sent as-is; edit PUTs the mapped editable fields to
 * the encoded status path; delete DELETEs that path and parses the returned
 * status; a 422 validation failure comes back as its http error.
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { type NewStatus, createStatus, deleteStatus, editStatus } from './statusWrite';
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

/** A create input that sets every field {@link NewStatus} offers. */
const FULL_INPUT: NewStatus = {
  status: 'Close the world.',
  spoilerText: 'nExt',
  visibility: 'local',
  sensitive: true,
  inReplyToId: '7',
  mediaIds: ['m1', 'm2'],
  language: 'ja',
  poll: { options: ['yes', 'no'], expiresIn: 3600, multiple: false },
  quoteId: '9',
};

/** The wire body {@link FULL_INPUT} maps to, every key in snake_case. */
const FULL_BODY = {
  status: 'Close the world.',
  spoiler_text: 'nExt',
  visibility: 'local',
  sensitive: true,
  in_reply_to_id: '7',
  media_ids: ['m1', 'm2'],
  language: 'ja',
  poll: { options: ['yes', 'no'], expires_in: 3600, multiple: false },
  quote_id: '9',
};

/** The error a failed result carries, failing the test when it succeeded. */
function failureOf(result: Result<unknown, ApiError>): ApiError {
  if (result.ok) {
    expect.fail('expected the call to fail');
  }
  return result.error;
}

describe(createStatus, () => {
  it('POSTs only the text with the idempotency key', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/statuses`, async ({ request }) => {
        expect(request.headers.get('Idempotency-Key')).toBe('key-1');
        expect(request.headers.get('Authorization')).toBe('Bearer secret');
        expect(request.headers.get('Content-Type')).toBe('application/json');

        const body: unknown = await request.json();

        expect(body).toStrictEqual({ status: 'Good morning.' });

        return HttpResponse.json(STATUS_WIRE);
      }),
    );

    const result = await createStatus(SESSION, { status: 'Good morning.' }, 'key-1');

    expect(result).toStrictEqual(ok(STATUS));
  });

  it('POSTs every field as a snake_case body, local visibility as-is', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/statuses`, async ({ request }) => {
        expect(request.headers.get('Idempotency-Key')).toBe('key-2');

        const body: unknown = await request.json();

        expect(body).toStrictEqual(FULL_BODY);

        return HttpResponse.json(STATUS_WIRE);
      }),
    );

    const result = await createStatus(SESSION, FULL_INPUT, 'key-2');

    expect(result).toStrictEqual(ok(STATUS));
  });

  it('reports a 422 validation failure as its http error', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/statuses`, () => {
        return HttpResponse.json(
          { error: "Validation failed: Text can't be blank" },
          { status: 422 },
        );
      }),
    );

    const result = await createStatus(SESSION, { status: '' }, 'key-3');

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 422,
      message: "Validation failed: Text can't be blank",
    });
  });
});

describe(editStatus, () => {
  it('PUTs the mapped editable fields to the status path', async () => {
    server.use(
      http.put(`${ORIGIN}/api/v1/statuses/1`, async ({ request }) => {
        const url = new URL(request.url);

        expect(url.pathname).toBe('/api/v1/statuses/1');
        expect(request.headers.get('Authorization')).toBe('Bearer secret');
        expect(request.headers.get('Content-Type')).toBe('application/json');

        const body: unknown = await request.json();

        expect(body).toStrictEqual({
          status: 'Good morning.',
          spoiler_text: 'later',
          sensitive: true,
          media_ids: ['m1'],
          language: 'en',
          poll: { options: ['yes', 'no'], expires_in: 900, multiple: true },
        });

        return HttpResponse.json(STATUS_WIRE);
      }),
    );

    const result = await editStatus(SESSION, '1', {
      status: 'Good morning.',
      spoilerText: 'later',
      sensitive: true,
      mediaIds: ['m1'],
      language: 'en',
      poll: { options: ['yes', 'no'], expiresIn: 900, multiple: true },
    });

    expect(result).toStrictEqual(ok(STATUS));
  });

  it('keeps an id with a slash inside one encoded path segment', async () => {
    server.use(
      http.put(`${ORIGIN}/api/v1/statuses/:id`, async ({ request }) => {
        expect(new URL(request.url).pathname).toBe('/api/v1/statuses/a%2Fb');

        const body: unknown = await request.json();

        expect(body).toStrictEqual({ status: 'x' });

        return HttpResponse.json(STATUS_WIRE);
      }),
    );

    const result = await editStatus(SESSION, 'a/b', { status: 'x' });

    expect(result).toStrictEqual(ok(STATUS));
  });
});

describe(deleteStatus, () => {
  it('DELETEs the status path and parses the deleted status', async () => {
    server.use(
      http.delete(`${ORIGIN}/api/v1/statuses/1`, ({ request }) => {
        const url = new URL(request.url);

        expect(url.pathname).toBe('/api/v1/statuses/1');
        expect(request.headers.get('Authorization')).toBe('Bearer secret');

        return HttpResponse.json(STATUS_WIRE);
      }),
    );

    const result = await deleteStatus(SESSION, '1');

    expect(result).toStrictEqual(ok(STATUS));
  });

  it('keeps an id with a slash inside one encoded path segment', async () => {
    server.use(
      http.delete(`${ORIGIN}/api/v1/statuses/:id`, ({ request }) => {
        expect(new URL(request.url).pathname).toBe('/api/v1/statuses/a%2Fb');

        return HttpResponse.json(STATUS_WIRE);
      }),
    );

    const result = await deleteStatus(SESSION, 'a/b');

    expect(result).toStrictEqual(ok(STATUS));
  });
});
