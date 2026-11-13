/**
 * The notification endpoints over the shared MSW server: the list sends its
 * page cursor, its repeated `types[]` and `exclude_types[]`, and neither filter
 * when the arrays are empty or absent, and brings its `Link` header back as
 * `links.next`; a cancelled request answers the aborted error. The dismiss
 * POSTs the encoded dismiss path and the clear POSTs its own, each becoming
 * ok(null) whatever the 2xx body, and a 500 reports as its http error.
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { clearNotifications, dismissNotification, listNotifications } from './notifications';
import { type Result, err, ok } from '../../lib/result';
import { server } from '../../test/server';
import type { ApiError } from '../errors';
import { type Notification, NotificationSchema } from '../schemas/notification';
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

/** A follow notification, with Pleroma's extra block to be dropped. */
const NOTIFICATION_WIRE = {
  id: '12',
  type: 'follow',
  created_at: '2026-11-12T21:14:05.000Z',
  account: ACCOUNT_WIRE,
  pleroma: { is_seen: false },
};

/** {@link NOTIFICATION_WIRE} as the shared schema reads it: kind derived. */
const NOTIFICATION: Notification = v.parse(NotificationSchema, NOTIFICATION_WIRE);

/** The empty page an answer without a `Link` header wraps into. */
const NO_LINKS = { items: [], links: { next: null, prev: null } };

/** The error a failed result carries, failing the test when it succeeded. */
function failureOf(result: Result<unknown, ApiError>): ApiError {
  if (result.ok) {
    expect.fail('expected the call to fail');
  }
  return result.error;
}

describe(listNotifications, () => {
  it('sends the page cursor and limit and returns the page with its next link', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/notifications`, ({ request }) => {
        const url = new URL(request.url);

        expect(request.method).toBe('GET');
        expect(request.headers.get('Authorization')).toBe('Bearer secret');
        expect(url.searchParams.get('max_id')).toBe('12');
        expect(url.searchParams.get('limit')).toBe('30');

        return HttpResponse.json([NOTIFICATION_WIRE], {
          headers: {
            Link: '<https://wired.example/api/v1/notifications?max_id=9>; rel="next"',
          },
        });
      }),
    );

    const result = await listNotifications(SESSION, {
      page: { cursor: { max_id: '12' }, limit: 30 },
    });

    expect(result).toStrictEqual({
      ok: true,
      value: {
        items: [NOTIFICATION],
        links: { next: { max_id: '9' }, prev: null },
      },
    });
  });

  it('sends each non-empty type filter as its own repeated [] parameter', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/notifications`, ({ request }) => {
        const url = new URL(request.url);

        expect(url.searchParams.getAll('types[]')).toStrictEqual(['mention', 'follow']);
        expect(url.searchParams.has('types')).toBe(false);
        expect(url.searchParams.getAll('exclude_types[]')).toStrictEqual(['reblog']);
        expect(url.searchParams.has('exclude_types')).toBe(false);

        return HttpResponse.json([]);
      }),
    );

    const result = await listNotifications(SESSION, {
      types: ['mention', 'follow'],
      excludeTypes: ['reblog'],
    });

    expect(result).toStrictEqual(ok(NO_LINKS));
  });

  it('sends neither filter for empty arrays, and no query at all when absent', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/notifications`, ({ request }) => {
        expect(new URL(request.url).search).toBe('');

        return HttpResponse.json([]);
      }),
    );

    const empty = await listNotifications(SESSION, { types: [], excludeTypes: [] });
    const absent = await listNotifications(SESSION, {});

    expect(empty).toStrictEqual(ok(NO_LINKS));
    expect(absent).toStrictEqual(ok(NO_LINKS));
  });

  it('maps an already-aborted signal to the aborted error', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/notifications`, () => {
        return HttpResponse.json([]);
      }),
    );

    const controller = new AbortController();
    controller.abort();

    const result = await listNotifications(SESSION, {}, controller.signal);

    expect(result).toStrictEqual(err({ kind: 'aborted' }));
  });
});

describe(dismissNotification, () => {
  it('POSTs the dismiss path with an empty body and answers null', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/notifications/12/dismiss`, ({ request }) => {
        const url = new URL(request.url);

        expect(request.method).toBe('POST');
        expect(request.headers.get('Authorization')).toBe('Bearer secret');
        expect(url.pathname).toBe('/api/v1/notifications/12/dismiss');
        expect(request.headers.get('Content-Type')).toBeNull();

        return HttpResponse.json({});
      }),
    );

    const result = await dismissNotification(SESSION, '12');

    expect(result).toStrictEqual(ok(null));
  });

  it('keeps an id with a slash inside one encoded path segment', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/notifications/:id/dismiss`, ({ request }) => {
        expect(new URL(request.url).pathname).toBe('/api/v1/notifications/a%2Fb/dismiss');

        return HttpResponse.json({ status: 'ok' });
      }),
    );

    const result = await dismissNotification(SESSION, 'a/b');

    expect(result).toStrictEqual(ok(null));
  });

  it('reports a 500 as its http error', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/notifications/12/dismiss`, () => {
        return HttpResponse.json({ error: 'Server error' }, { status: 500 });
      }),
    );

    const result = await dismissNotification(SESSION, '12');

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 500,
      message: 'Server error',
    });
  });
});

describe(clearNotifications, () => {
  it('POSTs the clear path and answers null', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/notifications/clear`, ({ request }) => {
        expect(request.method).toBe('POST');
        expect(request.headers.get('Authorization')).toBe('Bearer secret');
        expect(new URL(request.url).pathname).toBe('/api/v1/notifications/clear');

        return new HttpResponse(null, { status: 204 });
      }),
    );

    const result = await clearNotifications(SESSION);

    expect(result).toStrictEqual(ok(null));
  });

  it('reports a 500 as its http error', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/notifications/clear`, () => {
        return HttpResponse.json({ error: 'Server error' }, { status: 500 });
      }),
    );

    const result = await clearNotifications(SESSION);

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 500,
      message: 'Server error',
    });
  });
});
