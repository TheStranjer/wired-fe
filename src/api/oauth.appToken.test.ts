/**
 * Tests for the app token request: a `client_credentials` grant of the
 * registered app over the shared MSW server, answered with the token, and an
 * http error when the instance refuses the client.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { OAUTH_SCOPES, requestAppToken } from './oauth';
import { server } from '../test/server';

const ORIGIN = 'https://wired.example';
const APP = { client_id: 'client-abc', client_secret: 'secret-xyz' };

describe(requestAppToken, () => {
  it('posts the client credentials grant and returns the token', async () => {
    server.use(
      http.post(`${ORIGIN}/oauth/token`, async ({ request }) => {
        const payload: unknown = await request.json();

        expect(payload).toStrictEqual({
          grant_type: 'client_credentials',
          client_id: 'client-abc',
          client_secret: 'secret-xyz',
          scope: OAUTH_SCOPES,
        });

        return HttpResponse.json({ access_token: 'app-token', token_type: 'Bearer' });
      }),
    );

    const result = await requestAppToken(ORIGIN, { app: APP });

    expect(result).toStrictEqual({
      ok: true,
      value: {
        access_token: 'app-token',
        token_type: 'Bearer',
        scope: '',
        refresh_token: null,
        expires_in: null,
      },
    });
  });

  it('returns the http error of a refused client', async () => {
    server.use(
      http.post(`${ORIGIN}/oauth/token`, () =>
        HttpResponse.json({ error: 'Client authentication failed' }, { status: 401 }),
      ),
    );

    const result = await requestAppToken(ORIGIN, { app: APP });

    expect(result).toStrictEqual({
      ok: false,
      error: { kind: 'http', status: 401, message: 'Client authentication failed' },
    });
  });
});
