/**
 * Tests for telling WiredFE's own login request from another app's (WFE-177):
 * the client must be the app cached for this origin and page, and the request
 * must name this page as its redirect or carry the pending login's state.
 */
import { describe, expect, it } from 'vitest';

import { type OwnEnv, isOwnRequest } from './ownRequest';
import { savePendingLogin } from '../accounts/pendingLogin';
import { createStore } from '../storage/store';
import { memoryBackend } from '../test/memoryBackend';

const ORIGIN = 'https://wired.example';
const PAGE = { origin: ORIGIN, pathname: '/' };
const REDIRECT = `${ORIGIN}/`;
const NOW = 1_000_000;

/** An env whose app cache holds WiredFE's own app, `own`. */
function makeEnv(): OwnEnv {
  const apps = createStore('apps', memoryBackend());
  apps.set(`${ORIGIN} ${REDIRECT}`, { client_id: 'own', client_secret: 's' });
  return { apps, login: createStore('login', memoryBackend()), page: PAGE, now: NOW };
}

/** Start a pending login with {@link state} at {@link origin}. */
function pend(env: OwnEnv, state: string, origin: string = ORIGIN): void {
  savePendingLogin(env.login, { origin, state, redirectUri: REDIRECT, createdAt: NOW });
}

describe(isOwnRequest, () => {
  it('is own when the client is the cached app and the redirect is this page', () => {
    const query = { client_id: 'own', redirect_uri: REDIRECT };

    expect(isOwnRequest(query, ORIGIN, makeEnv())).toBe(true);
  });

  it('is own when the client is the cached app and the state is the pending login’s', () => {
    const env = makeEnv();
    pend(env, 'abc');

    expect(isOwnRequest({ client_id: 'own', state: 'abc' }, ORIGIN, env)).toBe(true);
  });

  it('is not own for another client', () => {
    const query = { client_id: 'other', redirect_uri: REDIRECT };

    expect(isOwnRequest(query, ORIGIN, makeEnv())).toBe(false);
  });

  it('is not own when no app is cached', () => {
    const env = { ...makeEnv(), apps: createStore('apps', memoryBackend()) };

    expect(isOwnRequest({ client_id: 'own', redirect_uri: REDIRECT }, ORIGIN, env)).toBe(false);
  });

  it('is not own for another redirect and no matching pending login', () => {
    const env = makeEnv();
    pend(env, 'abc', 'https://elsewhere.example');

    expect(
      isOwnRequest({ client_id: 'own', redirect_uri: 'https://x/cb', state: 'abc' }, ORIGIN, env),
    ).toBe(false);
    expect(
      isOwnRequest({ client_id: 'own', redirect_uri: 'https://x/cb', state: 'zzz' }, ORIGIN, env),
    ).toBe(false);
    expect(isOwnRequest({ client_id: 'own' }, ORIGIN, makeEnv())).toBe(false);
  });
});
