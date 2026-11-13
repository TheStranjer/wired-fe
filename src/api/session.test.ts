/**
 * Tests for session forwarding: the session's origin selects the instance and
 * its token becomes the `Authorization` header — a null token sends none.
 * Everything past origin and token is `apiRequest`'s business (./http.test.ts).
 */
import { HttpResponse, http } from 'msw';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { type ApiSession, sessionRequest, sessionRequestData } from './session';
import { err, ok } from '../lib/result';
import { server } from '../test/server';

const ORIGIN = 'https://wired.example';

const PATH = '/api/v1/accounts/verify_credentials';

const profileSchema = v.object({ id: v.string(), name: v.string() });

const PROFILE = { id: '1', name: 'Lain' };

describe(sessionRequest, () => {
  it('sends the session token as a bearer header', async () => {
    server.use(
      http.get(`${ORIGIN}${PATH}`, ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer secret');

        return HttpResponse.json(PROFILE);
      }),
    );

    const session: ApiSession = { origin: ORIGIN, token: 'secret' };
    const result = await sessionRequest(session, { path: PATH, schema: profileSchema });

    expect(result).toStrictEqual(ok({ data: PROFILE, link: null }));
  });

  it('sends no Authorization header when the token is null', async () => {
    server.use(
      http.get(`${ORIGIN}${PATH}`, ({ request }) => {
        expect(request.headers.has('Authorization')).toBe(false);

        return HttpResponse.json(PROFILE);
      }),
    );

    const session: ApiSession = { origin: ORIGIN, token: null };
    const result = await sessionRequest(session, { path: PATH, schema: profileSchema });

    expect(result).toStrictEqual(ok({ data: PROFILE, link: null }));
  });

  it('forwards the remaining request options unchanged', async () => {
    server.use(
      http.post(`${ORIGIN}/statuses`, async ({ request }) => {
        const url = new URL(request.url);

        expect(request.headers.get('Content-Type')).toBe('application/json');
        expect(url.searchParams.get('source')).toBe('web');

        const payload: unknown = await request.json();

        expect(payload).toStrictEqual({ status: 'hello' });

        return HttpResponse.json(PROFILE, { headers: { Link: '<https://x/n>; rel="next"' } });
      }),
    );

    const session: ApiSession = { origin: ORIGIN, token: 'secret' };
    const result = await sessionRequest(session, {
      path: '/statuses',
      method: 'POST',
      query: { source: 'web' },
      json: { status: 'hello' },
      schema: profileSchema,
    });

    expect(result).toStrictEqual(ok({ data: PROFILE, link: '<https://x/n>; rel="next"' }));
  });
});

describe(sessionRequestData, () => {
  it('keeps only the validated data of a success', async () => {
    server.use(
      http.get(`${ORIGIN}${PATH}`, () => {
        return HttpResponse.json({ ...PROFILE, secret: 'x' });
      }),
    );

    const session: ApiSession = { origin: ORIGIN, token: 'secret' };
    const result = await sessionRequestData(session, { path: PATH, schema: profileSchema });

    expect(result).toStrictEqual(ok(PROFILE));
  });

  it('passes a failure through unchanged', async () => {
    server.use(
      http.get(`${ORIGIN}${PATH}`, () => {
        return HttpResponse.json({ error: 'Denied' }, { status: 403 });
      }),
    );

    const session: ApiSession = { origin: ORIGIN, token: 'secret' };
    const result = await sessionRequestData(session, { path: PATH, schema: profileSchema });

    expect(result).toStrictEqual(err({ kind: 'http', status: 403, message: 'Denied' }));
  });
});
