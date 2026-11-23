/**
 * Tests for the token-refresh seam's happy paths: a 401 trades the stored
 * refresh token for a new pair once — however many calls were refused
 * together — stores and announces it, and retries the call once with the new
 * token; everything that is not a 401 passes through without a refresh. The
 * instance is served by MSW (src/test/refreshHarness); the expiry paths are in
 * ./refreshSession.expired.test.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { withFreshToken } from './refreshSession';
import type { ApiError } from '../api/errors';
import type { ApiSession } from '../api/session';
import { type Result, err, ok } from '../lib/result';
import { status } from '../test/fixtures';
import {
  ORIGIN,
  newPair,
  readStatus,
  serveRefresh,
  serveStatus,
  setup,
} from '../test/refreshHarness';
import { server } from '../test/server';

describe(withFreshToken, () => {
  it('refreshes after a 401, retries once and keeps the new tokens', async () => {
    const { deps, key, actions, accounts } = setup();
    serveStatus('token-2');
    const refresh = serveRefresh(newPair);

    const result = await withFreshToken(deps, key, readStatus);

    expect(result).toStrictEqual(ok(status('1')));
    expect(refresh.requests()).toBe(1);
    expect(accounts.get(key)).toMatchObject({
      token: 'token-2',
      refreshToken: 'refresh-2',
      expiresAt: 1_000_000 + 3_600_000,
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: 'accounts', activeKey: key });
  });

  it('sends the refresh grant with the cached app and the stored refresh token', async () => {
    const { deps, key } = setup();
    serveStatus('token-2');
    let body: unknown = null;
    server.use(
      http.post(`${ORIGIN}/oauth/token`, async ({ request }) => {
        body = await request.json();
        return newPair();
      }),
    );

    await withFreshToken(deps, key, readStatus);

    expect(body).toStrictEqual({
      grant_type: 'refresh_token',
      refresh_token: 'refresh-1',
      client_id: 'cid',
      client_secret: 'csecret',
    });
  });

  it('keeps the old refresh token and an unknown expiry when the answer names none', async () => {
    const { deps, key, accounts } = setup();
    serveStatus('token-2');
    serveRefresh(() => HttpResponse.json({ access_token: 'token-2' }));

    await withFreshToken(deps, key, readStatus);

    expect(accounts.get(key)).toMatchObject({
      token: 'token-2',
      refreshToken: 'refresh-1',
      expiresAt: null,
    });
  });

  it('sends one refresh request for two concurrent 401s and retries both', async () => {
    const { deps, key } = setup();
    serveStatus('token-2');
    const refresh = serveRefresh(newPair);

    const results = await Promise.all([
      withFreshToken(deps, key, readStatus),
      withFreshToken(deps, key, readStatus),
    ]);

    expect(results.map((result) => result.ok)).toStrictEqual([true, true]);
    expect(refresh.requests()).toBe(1);
  });

  it('retries with a token another call already replaced, without a refresh', async () => {
    const { deps, key, accounts } = setup();
    serveStatus('token-2');
    const refresh = serveRefresh(newPair);
    const racing = async (session: ApiSession): Promise<Result<unknown, ApiError>> => {
      const answer = await readStatus(session);
      accounts.updateTokens(key, { token: 'token-2', refreshToken: 'refresh-2', expiresAt: null });
      return answer;
    };

    const result = await withFreshToken(deps, key, racing);

    expect(result.ok).toBe(true);
    expect(refresh.requests()).toBe(0);
  });

  it('passes other errors and answers through without a refresh', async () => {
    const { deps, key, actions } = setup();
    const refresh = serveRefresh(newPair);
    server.use(
      http.get(`${ORIGIN}/api/v1/statuses/1`, () =>
        HttpResponse.json({ error: 'Boom' }, { status: 500 }),
      ),
    );

    const failed = await withFreshToken(deps, key, readStatus);
    serveStatus('token-1');
    const fine = await withFreshToken(deps, key, readStatus);

    expect(failed).toStrictEqual(err({ kind: 'http', status: 500, message: 'Boom' }));
    expect(fine).toStrictEqual(ok(status('1')));
    expect(refresh.requests()).toBe(0);
    expect(actions).toStrictEqual([]);
  });

  it('answers not logged in for an account nobody is signed in as', async () => {
    const { deps } = setup();
    const call = vi.fn<typeof readStatus>();

    const result = await withFreshToken(deps, 'https://other.example#9', call);

    expect(result).toStrictEqual(
      err({ kind: 'http', status: 401, message: 'Not logged in. Type /connect' }),
    );
    expect(call).not.toHaveBeenCalled();
  });
});
