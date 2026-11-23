/**
 * Tests for the password token request: a `password` grant of the registered
 * app over the shared MSW server, answered with the token, and an http error
 * when the instance refuses the credentials.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { OAUTH_SCOPES, requestPasswordToken } from './oauth';
import { server } from '../test/server';

const ORIGIN = 'https://wired.example';
const PARAMS = {
  app: { client_id: 'client-abc', client_secret: 'secret-xyz' },
  username: 'lain',
  password: 'correct horse',
};

describe(requestPasswordToken, () => {
  it('posts the password grant and returns the token', async () => {
    server.use(
      http.post(`${ORIGIN}/oauth/token`, async ({ request }) => {
        const payload: unknown = await request.json();

        expect(payload).toStrictEqual({
          grant_type: 'password',
          username: 'lain',
          password: 'correct horse',
          client_id: 'client-abc',
          client_secret: 'secret-xyz',
          scope: OAUTH_SCOPES,
        });

        return HttpResponse.json({
          access_token: 'user-token',
          refresh_token: 'r-1',
          expires_in: 60,
        });
      }),
    );

    await expect(requestPasswordToken(ORIGIN, PARAMS)).resolves.toStrictEqual({
      ok: true,
      value: {
        access_token: 'user-token',
        token_type: 'Bearer',
        scope: '',
        refresh_token: 'r-1',
        expires_in: 60,
      },
    });
  });

  it('returns the http error of refused credentials', async () => {
    server.use(
      http.post(`${ORIGIN}/oauth/token`, () =>
        HttpResponse.json({ error: 'Invalid credentials' }, { status: 400 }),
      ),
    );

    await expect(requestPasswordToken(ORIGIN, PARAMS)).resolves.toStrictEqual({
      ok: false,
      error: { kind: 'http', status: 400, message: 'Invalid credentials' },
    });
  });
});
