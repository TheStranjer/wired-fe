/**
 * Tests for the token-refresh seam's expiry paths: an account with no refresh
 * token, whose refresh the instance refuses, whose app cannot be had, or that
 * nothing can refresh for is marked expired and reported once in the status
 * window, and the caller gets the original 401 back. The instance is served
 * by MSW (src/test/refreshHarness).
 */
import { HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { withFreshToken } from './refreshSession';
import type { ApiError } from '../api/errors';
import type { ApiSession } from '../api/session';
import { type Result, err } from '../lib/result';
import {
  EXPIRED_LINE,
  readStatus,
  serveRefresh,
  serveStatus,
  setup,
  statusLines,
} from '../test/refreshHarness';

describe('withFreshToken expiry', () => {
  it('expires the account once and returns the 401 when it has no refresh token', async () => {
    const { deps, key, actions } = setup(null);
    serveStatus('token-2');

    const result = await withFreshToken(deps, key, readStatus);

    expect(result).toStrictEqual(
      err({ kind: 'http', status: 401, message: 'The access token is invalid' }),
    );
    expect(actions.map((action) => action.type)).toStrictEqual(['accountExpired', 'print']);
    expect(actions[0]).toStrictEqual({ type: 'accountExpired', accountKey: key });
    expect(statusLines(actions)).toStrictEqual([EXPIRED_LINE]);
  });

  it('expires the account when the instance refuses the refresh', async () => {
    const { deps, key, actions, accounts } = setup();
    serveStatus('token-2');
    serveRefresh(() => HttpResponse.json({ error: 'invalid_grant' }, { status: 400 }));

    const result = await withFreshToken(deps, key, readStatus);

    expect(result.ok).toBe(false);
    expect(actions[0]).toStrictEqual({ type: 'accountExpired', accountKey: key });
    expect(statusLines(actions)).toStrictEqual([EXPIRED_LINE]);
    expect(accounts.get(key)?.token).toBe('token-1');
  });

  it('expires the account when the app cannot be had', async () => {
    const { deps, key, actions, getApp } = setup();
    serveStatus('token-2');
    getApp.mockResolvedValue(err({ kind: 'network', message: 'down' }));

    const result = await withFreshToken(deps, key, readStatus);

    expect(result.ok).toBe(false);
    expect(statusLines(actions)).toStrictEqual([EXPIRED_LINE]);
  });

  it('expires an account when nothing can refresh at all', async () => {
    const { deps, key, actions } = setup();
    serveStatus('token-2');

    const result = await withFreshToken({ ...deps, refresher: null }, key, readStatus);

    expect(result.ok).toBe(false);
    expect(statusLines(actions)).toStrictEqual([EXPIRED_LINE]);
  });

  it('reports an expired account once across many refused calls', async () => {
    const { deps, key, actions } = setup(null);
    serveStatus('token-2');

    await withFreshToken(deps, key, readStatus);
    const again = await withFreshToken(deps, key, readStatus);

    expect(again.ok).toBe(false);
    expect(statusLines(actions)).toStrictEqual([EXPIRED_LINE]);
  });

  it('returns the 401 untouched when the account left while the call was out', async () => {
    const { deps, key, accounts, actions } = setup();
    serveStatus('token-2');
    const leaving = async (session: ApiSession): Promise<Result<unknown, ApiError>> => {
      const answer = await readStatus(session);
      accounts.remove(key);
      deps.dispatch({ type: 'accounts', accounts: [], activeKey: null });
      return answer;
    };

    const result = await withFreshToken(deps, key, leaving);

    expect(result.ok).toBe(false);
    expect(actions.map((action) => action.type)).toStrictEqual(['accounts']);
  });
});
