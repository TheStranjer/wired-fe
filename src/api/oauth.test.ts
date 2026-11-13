/**
 * Tests for the OAuth endpoints over the shared MSW server: every call's
 * method, path and JSON body, the credentials and token the schemas keep, the
 * token defaults, the `{}` answer of a revocation, and the http errors of a
 * rejected registration and of a refused grant.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import type { ApiError } from './errors';
import {
  type AppCredentials,
  type Token,
  OAUTH_SCOPES,
  exchangeCode,
  registerApp,
  revokeToken,
} from './oauth';
import { type Result, ok } from '../lib/result';
import { server } from '../test/server';

const ORIGIN = 'https://wired.example';
const REDIRECT_URI = `${ORIGIN}/auth/callback`;

const APP: AppCredentials = { client_id: 'client-abc', client_secret: 'secret-xyz' };

const TOKEN: Token = { access_token: 'token-1', token_type: 'Bearer', scope: OAUTH_SCOPES };

/** The error a failed result carries, failing the test when it succeeded. */
function failureOf(result: Result<unknown, ApiError>): ApiError {
  if (result.ok) {
    expect.fail('expected the call to fail');
  }
  return result.error;
}

describe(registerApp, () => {
  it('posts the app details and returns just the credentials', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/apps`, async ({ request }) => {
        expect(request.method).toBe('POST');

        const payload: unknown = await request.json();

        expect(payload).toStrictEqual({
          client_name: 'WiredFE',
          redirect_uris: REDIRECT_URI,
          scopes: OAUTH_SCOPES,
        });

        return HttpResponse.json({
          id: '7',
          name: 'WiredFE',
          website: null,
          redirect_uri: REDIRECT_URI,
          client_id: 'client-abc',
          client_secret: 'secret-xyz',
          vapid_key: 'vapid',
        });
      }),
    );

    const result = await registerApp(ORIGIN, { appName: 'WiredFE', redirectUri: REDIRECT_URI });

    expect(result).toStrictEqual(ok(APP));
  });

  it('propagates a 422 as its http error', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/apps`, async ({ request }) => {
        expect(request.method).toBe('POST');

        const payload: unknown = await request.json();

        expect(payload).toStrictEqual({
          client_name: '',
          redirect_uris: REDIRECT_URI,
          scopes: OAUTH_SCOPES,
        });

        return HttpResponse.json(
          { error: 'Validation failed: Client name cannot be blank' },
          { status: 422 },
        );
      }),
    );

    const result = await registerApp(ORIGIN, { appName: '', redirectUri: REDIRECT_URI });

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 422,
      message: 'Validation failed: Client name cannot be blank',
    });
  });
});

describe(exchangeCode, () => {
  it('posts the authorization code and returns the token', async () => {
    server.use(
      http.post(`${ORIGIN}/oauth/token`, async ({ request }) => {
        expect(request.method).toBe('POST');

        const payload: unknown = await request.json();

        expect(payload).toStrictEqual({
          grant_type: 'authorization_code',
          code: 'auth-code',
          client_id: APP.client_id,
          client_secret: APP.client_secret,
          redirect_uri: REDIRECT_URI,
          scope: OAUTH_SCOPES,
        });

        return HttpResponse.json({ ...TOKEN, created_at: 1_763_000_000 });
      }),
    );

    const result = await exchangeCode(ORIGIN, {
      app: APP,
      code: 'auth-code',
      redirectUri: REDIRECT_URI,
    });

    expect(result).toStrictEqual(ok(TOKEN));
  });

  it('defaults token_type to Bearer and scope to the empty string', async () => {
    server.use(
      http.post(`${ORIGIN}/oauth/token`, async ({ request }) => {
        expect(request.method).toBe('POST');

        const payload: unknown = await request.json();

        expect(payload).toStrictEqual({
          grant_type: 'authorization_code',
          code: 'auth-code',
          client_id: APP.client_id,
          client_secret: APP.client_secret,
          redirect_uri: REDIRECT_URI,
          scope: OAUTH_SCOPES,
        });

        return HttpResponse.json({ access_token: 'token-1' });
      }),
    );

    const result = await exchangeCode(ORIGIN, {
      app: APP,
      code: 'auth-code',
      redirectUri: REDIRECT_URI,
    });

    expect(result).toStrictEqual(ok({ access_token: 'token-1', token_type: 'Bearer', scope: '' }));
  });

  it('maps a 400 invalid_grant to an http error with that message', async () => {
    server.use(
      http.post(`${ORIGIN}/oauth/token`, async ({ request }) => {
        expect(request.method).toBe('POST');

        const payload: unknown = await request.json();

        expect(payload).toStrictEqual({
          grant_type: 'authorization_code',
          code: 'expired-code',
          client_id: APP.client_id,
          client_secret: APP.client_secret,
          redirect_uri: REDIRECT_URI,
          scope: OAUTH_SCOPES,
        });

        return HttpResponse.json({ error: 'invalid_grant' }, { status: 400 });
      }),
    );

    const result = await exchangeCode(ORIGIN, {
      app: APP,
      code: 'expired-code',
      redirectUri: REDIRECT_URI,
    });

    expect(failureOf(result)).toStrictEqual({
      kind: 'http',
      status: 400,
      message: 'invalid_grant',
    });
  });
});

describe(revokeToken, () => {
  it('posts the token and accepts an empty object answer as null', async () => {
    server.use(
      http.post(`${ORIGIN}/oauth/revoke`, async ({ request }) => {
        expect(request.method).toBe('POST');

        const payload: unknown = await request.json();

        expect(payload).toStrictEqual({
          client_id: APP.client_id,
          client_secret: APP.client_secret,
          token: TOKEN.access_token,
        });

        return HttpResponse.json({});
      }),
    );

    const result = await revokeToken(ORIGIN, { app: APP, token: TOKEN.access_token });

    expect(result).toStrictEqual(ok(null));
  });
});
