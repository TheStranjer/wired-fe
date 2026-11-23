/**
 * Tests for the authorization endpoints over the shared MSW server: the
 * app-info request carries the query and asks for JSON, the decision carries
 * the bearer token and the JSON body, a `redirect_uri` or a `code` answer is
 * told apart, and refusals arrive as the shared http errors.
 */
import { describe, expect, it } from 'vitest';

import { getAuthorizeInfo, postAuthorize } from './authorize';
import { ORIGIN, QUERY, mockAuthorize } from '../../test/authorizeServer';

const SESSION = { origin: ORIGIN, token: 'user-token' };

describe(getAuthorizeInfo, () => {
  it('sends the query as JSON and maps the answer', async () => {
    const seen = mockAuthorize();

    const result = await getAuthorizeInfo(SESSION, QUERY);

    expect(result).toStrictEqual({
      ok: true,
      value: {
        app: { name: 'Cool App', website: 'https://cool.example' },
        scopes: ['read', 'write:statuses'],
        redirectUri: 'https://cool.example/cb',
        state: 'xyz',
      },
    });
    expect(seen.accept).toBe('application/json');
    expect(Object.fromEntries(seen.query ?? [])).toStrictEqual(QUERY);
  });

  it('allows an app with no website and no state', async () => {
    mockAuthorize({
      info: {
        body: { app: { name: 'Bare' }, scopes: [], redirect_uri: 'urn:ietf:wg:oauth:2.0:oob' },
      },
    });

    const result = await getAuthorizeInfo(SESSION, QUERY);

    expect(result).toMatchObject({ ok: true, value: { app: { website: null }, state: null } });
  });

  it('returns the http error of a refused request', async () => {
    mockAuthorize({ info: { status: 400, body: { error: 'invalid_request' } } });

    await expect(getAuthorizeInfo(SESSION, QUERY)).resolves.toStrictEqual({
      ok: false,
      error: { kind: 'http', status: 400, message: 'invalid_request' },
    });
  });
});

describe(postAuthorize, () => {
  const BODY = {
    client_id: 'client-1',
    redirect_uri: 'https://cool.example/cb',
    scope: 'read',
    approve: true,
  };

  it('posts the body under the bearer token and reads a redirect', async () => {
    const seen = mockAuthorize();

    const result = await postAuthorize(SESSION, BODY);

    expect(result).toStrictEqual({
      ok: true,
      value: { kind: 'redirect', uri: 'https://cool.example/cb?code=abc&state=xyz' },
    });
    expect(seen.auth).toBe('Bearer user-token');
    expect(seen.body).toStrictEqual(BODY);
  });

  it('reads a code', async () => {
    mockAuthorize({ decision: { body: { code: 'abc' } } });

    await expect(postAuthorize(SESSION, BODY)).resolves.toStrictEqual({
      ok: true,
      value: { kind: 'code', code: 'abc' },
    });
  });

  it('returns the http error of a refusal', async () => {
    mockAuthorize({ decision: { status: 403, body: { error: 'unauthorized_client' } } });

    await expect(postAuthorize(SESSION, BODY)).resolves.toStrictEqual({
      ok: false,
      error: { kind: 'http', status: 403, message: 'unauthorized_client' },
    });
  });

  it('reports an answer with neither as a parse error', async () => {
    mockAuthorize({ decision: { body: {} } });

    await expect(postAuthorize(SESSION, BODY)).resolves.toMatchObject({
      ok: false,
      error: { kind: 'parse' },
    });
  });
});
