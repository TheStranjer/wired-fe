/**
 * The account action endpoints over the shared MSW server: one table-driven
 * test per action checking the POST path and the parsed relationship
 * returned, the percent-encoded id kept inside one path segment, follow's
 * `reblogs` and mute's `notifications` and `duration` sent as JSON bodies
 * only when set and never on an action that does not take them, and a 403
 * reported as its http error.
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { type AccountAction, type AccountActionOptions, accountAction } from './accountActions';
import { type Result, ok } from '../../lib/result';
import { server } from '../../test/server';
import type { ApiError } from '../errors';
import { RelationshipSchema } from '../schemas/relationship';
import type { ApiSession } from '../session';

const ORIGIN = 'https://wired.example';

const SESSION: ApiSession = { origin: ORIGIN, token: 'secret' };

/** The six actions, as the endpoint's own union names them. */
const ACTIONS: readonly AccountAction[] = [
  'follow',
  'unfollow',
  'block',
  'unblock',
  'mute',
  'unmute',
];

/** The relationship a backend answers an action with, and the schema's reading. */
const RELATIONSHIP_WIRE = {
  id: '109',
  following: true,
  followed_by: false,
  requested: false,
  blocking: false,
  blocked_by: false,
  muting: false,
  muting_notifications: false,
  domain_blocking: false,
  showing_reblogs: true,
  notifying: false,
  endorsed: false,
  note: '',
};

const RELATIONSHIP = v.parse(RelationshipSchema, RELATIONSHIP_WIRE);

/** Every option {@link AccountActionOptions} offers, all set at once. */
const ALL_OPTIONS: AccountActionOptions = { reblogs: false, notifications: true, duration: 0 };

/** The error a failed result carries, failing the test when it succeeded. */
function failureOf(result: Result<unknown, ApiError>): ApiError {
  if (result.ok) {
    expect.fail('expected the call to fail');
  }
  return result.error;
}

describe(accountAction, () => {
  it.each(ACTIONS)('POSTs the %s path and returns the parsed relationship', async (action) => {
    server.use(
      http.post(`${ORIGIN}/api/v1/accounts/1/${action}`, ({ request }) => {
        const url = new URL(request.url);

        expect(request.headers.get('Authorization')).toBe('Bearer secret');
        expect(url.pathname).toBe(`/api/v1/accounts/1/${action}`);

        return HttpResponse.json(RELATIONSHIP_WIRE);
      }),
    );

    const result = await accountAction(SESSION, '1', action);

    expect(result).toStrictEqual(ok(RELATIONSHIP));
  });

  it('keeps an id with a slash inside one encoded path segment', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/accounts/:id/follow`, ({ request }) => {
        expect(new URL(request.url).pathname).toBe('/api/v1/accounts/a%2Fb/follow');

        return HttpResponse.json(RELATIONSHIP_WIRE);
      }),
    );

    const result = await accountAction(SESSION, 'a/b', 'follow');

    expect(result).toStrictEqual(ok(RELATIONSHIP));
  });

  it('sends no body when the action is asked without options', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/accounts/1/follow`, async ({ request }) => {
        expect(request.headers.get('Content-Type')).toBeNull();

        const body: unknown = await request.text();

        expect(body).toBe('');

        return HttpResponse.json(RELATIONSHIP_WIRE);
      }),
    );

    const result = await accountAction(SESSION, '1', 'follow');

    expect(result).toStrictEqual(ok(RELATIONSHIP));
  });

  it('sends the reblogs body for follow with the option set', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/accounts/1/follow`, async ({ request }) => {
        expect(request.headers.get('Content-Type')).toBe('application/json');

        const body: unknown = await request.json();

        expect(body).toStrictEqual({ reblogs: false });

        return HttpResponse.json(RELATIONSHIP_WIRE);
      }),
    );

    const result = await accountAction(SESSION, '1', 'follow', { reblogs: false });

    expect(result).toStrictEqual(ok(RELATIONSHIP));
  });

  it('sends both bodies for mute with the options set, duration 0 included', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/accounts/1/mute`, async ({ request }) => {
        expect(request.headers.get('Content-Type')).toBe('application/json');

        const body: unknown = await request.json();

        expect(body).toStrictEqual({ notifications: true, duration: 0 });

        return HttpResponse.json(RELATIONSHIP_WIRE);
      }),
    );

    const result = await accountAction(SESSION, '1', 'mute', {
      notifications: true,
      duration: 0,
    });

    expect(result).toStrictEqual(ok(RELATIONSHIP));
  });

  it('ignores every option irrelevant to block and sends no body', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/accounts/1/block`, async ({ request }) => {
        expect(request.headers.get('Content-Type')).toBeNull();

        const body: unknown = await request.text();

        expect(body).toBe('');

        return HttpResponse.json(RELATIONSHIP_WIRE);
      }),
    );

    const result = await accountAction(SESSION, '1', 'block', ALL_OPTIONS);

    expect(result).toStrictEqual(ok(RELATIONSHIP));
  });

  it('reports a 403 as its http error', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/accounts/1/follow`, () => {
        return HttpResponse.json({ error: 'Not allowed' }, { status: 403 });
      }),
    );

    const result = await accountAction(SESSION, '1', 'follow');

    expect(failureOf(result)).toStrictEqual({ kind: 'http', status: 403, message: 'Not allowed' });
  });
});
