/**
 * The conversation endpoints over the shared MSW server: the list sends its
 * page cursor and limit and brings its `Link` header back as `links.next`, a
 * conversation of either backend's shape normalizes through the shared schema,
 * a cancelled request answers the aborted error and a 401 the http one; the
 * mark POSTs the encoded read path with an empty body and returns the
 * conversation the server answered, its `unread` cleared.
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { listConversations, markConversationRead } from './conversations';
import { type Result, err, ok } from '../../lib/result';
import { server } from '../../test/server';
import type { ApiError } from '../errors';
import { type Conversation, ConversationSchema } from '../schemas/conversation';
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

/** The minimal last status of a direct thread, as a backend sends it. */
const STATUS_WIRE = {
  id: '7',
  uri: 'https://wired.example/posts/7',
  created_at: '2026-11-12T21:14:05.000Z',
  account: ACCOUNT_WIRE,
  content: '<p>is anyone there?</p>',
  visibility: 'direct',
  replies_count: 0,
  reblogs_count: 0,
  favourites_count: 0,
};

/** One unread conversation, with Pleroma's extra block to be dropped. */
const CONVERSATION_WIRE = {
  id: '3',
  accounts: [ACCOUNT_WIRE],
  unread: true,
  last_status: STATUS_WIRE,
  pleroma: { recipients: ['https://wired.example/users/lain'] },
};

/** {@link CONVERSATION_WIRE} as the shared schema reads it: unread kept. */
const CONVERSATION: Conversation = v.parse(ConversationSchema, CONVERSATION_WIRE);

/** The mark's answer: the same thread with `unread` cleared. */
const READ_WIRE = { ...CONVERSATION_WIRE, unread: false };

const READ: Conversation = v.parse(ConversationSchema, READ_WIRE);

/** The error a failed result carries, failing the test when it succeeded. */
function failureOf(result: Result<unknown, ApiError>): ApiError {
  if (result.ok) {
    expect.fail('expected the call to fail');
  }
  return result.error;
}

describe(listConversations, () => {
  it('sends the cursor and limit and returns the page with its next link', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/conversations`, ({ request }) => {
        const url = new URL(request.url);

        expect(request.method).toBe('GET');
        expect(request.headers.get('Authorization')).toBe('Bearer secret');
        expect(url.searchParams.get('max_id')).toBe('5');
        expect(url.searchParams.get('limit')).toBe('20');

        return HttpResponse.json([CONVERSATION_WIRE], {
          headers: {
            Link: '<https://wired.example/api/v1/conversations?max_id=2>; rel="next"',
          },
        });
      }),
    );

    const result = await listConversations(SESSION, { cursor: { max_id: '5' }, limit: 20 });

    expect(result).toStrictEqual({
      ok: true,
      value: { items: [CONVERSATION], links: { next: { max_id: '2' }, prev: null } },
    });
  });

  it('asks for the first page with no query when given no page', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/conversations`, ({ request }) => {
        expect(new URL(request.url).search).toBe('');

        return HttpResponse.json([READ_WIRE]);
      }),
    );

    const result = await listConversations(SESSION);

    expect(result).toStrictEqual({
      ok: true,
      value: { items: [READ], links: { next: null, prev: null } },
    });
  });

  it('maps an already-aborted signal to the aborted error', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/conversations`, () => {
        return HttpResponse.json([]);
      }),
    );

    const controller = new AbortController();
    controller.abort();

    const result = await listConversations(SESSION, undefined, controller.signal);

    expect(result).toStrictEqual(err({ kind: 'aborted' }));
  });

  it('reports a 401 as its http error', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/conversations`, () => {
        return HttpResponse.json({ error: 'The access token is invalid' }, { status: 401 });
      }),
    );

    const result = await listConversations(SESSION);

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 401,
      message: 'The access token is invalid',
    });
  });

  it('reports a conversation missing its participants as a parse error', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/conversations`, () => {
        return HttpResponse.json([{ id: '3', unread: true }]);
      }),
    );

    const result = await listConversations(SESSION);

    expect(failureOf(result).kind).toBe('parse');
  });
});

describe(markConversationRead, () => {
  it('POSTs the read path with an empty body and returns the read conversation', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/conversations/3/read`, ({ request }) => {
        const url = new URL(request.url);

        expect(request.method).toBe('POST');
        expect(request.headers.get('Authorization')).toBe('Bearer secret');
        expect(url.pathname).toBe('/api/v1/conversations/3/read');
        expect(request.headers.get('Content-Type')).toBeNull();

        return HttpResponse.json(READ_WIRE);
      }),
    );

    const result = await markConversationRead(SESSION, '3');

    expect(result).toStrictEqual(ok(READ));
  });

  it('keeps an id with a slash inside one encoded path segment', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/conversations/:id/read`, ({ request }) => {
        expect(new URL(request.url).pathname).toBe('/api/v1/conversations/a%2Fb/read');

        return HttpResponse.json(READ_WIRE);
      }),
    );

    const result = await markConversationRead(SESSION, 'a/b');

    expect(result).toStrictEqual(ok(READ));
  });

  it('reports an unknown conversation as its 404', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/conversations/3/read`, () => {
        return HttpResponse.json({ error: 'Record not found' }, { status: 404 });
      }),
    );

    const result = await markConversationRead(SESSION, '3');

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 404,
      message: 'Record not found',
    });
  });
});
