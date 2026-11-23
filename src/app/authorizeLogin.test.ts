/**
 * Tests for the authorization's login helpers: which instance a request is
 * for (the build's, else the active account's), which account is already
 * signed in there, and the login itself — the instance a visitor must name is
 * resolved from what they typed or refused before any request, and an account
 * that comes of a login joins the session.
 */
import { describe, expect, it, vi } from 'vitest';

import { type LoginEnv, accountAt, loginForAuthorize, requestOrigin } from './authorizeLogin';
import { createAccountStore } from '../accounts/accountStore';
import { createStore } from '../storage/store';
import { memoryBackend } from '../test/memoryBackend';
import { ORIGIN, mockRegistration } from '../test/registrationServer';

/** The origin the page is on. */
const PAGE = window.location.origin;

/** A fresh account store. */
function makeAccounts() {
  return createAccountStore(createStore('accounts', memoryBackend()));
}

/** The record of an account at {@link origin}. */
function record(origin: string, accountId: string) {
  return {
    origin,
    accountId,
    handle: `u${accountId}@${origin}`,
    token: `t${accountId}`,
    refreshToken: null,
    expiresAt: null,
  };
}

describe(requestOrigin, () => {
  it('is the page’s own origin on a same-origin build', () => {
    expect(requestOrigin(makeAccounts(), { mode: 'same-origin' })).toBe(PAGE);
  });

  it('is the configured origin on a fixed build', () => {
    expect(requestOrigin(makeAccounts(), { mode: 'fixed', origin: ORIGIN })).toBe(ORIGIN);
  });

  it('is the active account’s origin where the visitor chooses', () => {
    const accounts = makeAccounts();
    accounts.add(record('https://other.example', '3'));

    expect(requestOrigin(accounts, { mode: 'open' })).toBe('https://other.example');
  });

  it('is unknown where the visitor chooses and nobody is signed in', () => {
    expect(requestOrigin(makeAccounts(), { mode: 'open' })).toBeNull();
  });
});

describe(accountAt, () => {
  it('prefers the active account when it lives at the origin', () => {
    const accounts = makeAccounts();
    accounts.add(record(ORIGIN, '1'));
    accounts.add(record(ORIGIN, '2'));
    accounts.add(record('https://other.example', '3'));
    accounts.setActive(`${ORIGIN}#1`);

    expect(accountAt(accounts, ORIGIN)?.accountId).toBe('1');
  });

  it('takes the first account at the origin when the active one lives elsewhere', () => {
    const accounts = makeAccounts();
    accounts.add(record(ORIGIN, '1'));
    accounts.add(record(ORIGIN, '2'));
    accounts.add(record('https://other.example', '3'));

    expect(accountAt(accounts, ORIGIN)?.accountId).toBe('1');
  });

  it('is null when nobody is signed in there, or the origin is unknown', () => {
    const accounts = makeAccounts();
    accounts.add(record(ORIGIN, '1'));

    expect(accountAt(accounts, 'https://other.example')).toBeNull();
    expect(accountAt(accounts, null)).toBeNull();
  });
});

/** A login environment over fresh stores whose instance read always fails. */
function makeEnv(overrides: Partial<LoginEnv>) {
  const accounts = makeAccounts();
  const dispatch = vi.fn();
  const detect = vi
    .fn<LoginEnv['detect']>()
    .mockResolvedValue({ ok: false, error: { kind: 'network', message: 'x' } });
  const env: LoginEnv = {
    dispatch,
    accounts,
    apps: createStore('apps', memoryBackend()),
    instances: { mode: 'same-origin' },
    origin: PAGE,
    detect,
    now: () => new Date(0),
    ...overrides,
  };
  return { env, accounts, dispatch, detect };
}

describe(loginForAuthorize, () => {
  it('signs in at the known origin and hands the account to the session', async () => {
    mockRegistration({ appToken: { body: { access_token: 'user-token' } } }, PAGE);
    const { env, accounts, dispatch, detect } = makeEnv({});

    const outcome = await loginForAuthorize(
      { instance: '', username: ' lain ', password: 'pw' },
      env,
    );

    expect(outcome.kind).toBe('ok');
    expect(accounts.list()).toHaveLength(1);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'accounts' }));
    expect(detect).toHaveBeenCalledExactlyOnceWith(PAGE);
  });

  it('signs in at the instance the visitor typed when none is known', async () => {
    mockRegistration({ appToken: { body: { access_token: 'user-token' } } });
    const { env, accounts } = makeEnv({ origin: null, instances: { mode: 'open' } });

    const outcome = await loginForAuthorize(
      { instance: 'wired.example', username: 'lain', password: 'pw' },
      env,
    );

    expect(outcome.kind).toBe('ok');
    expect(accounts.list()[0]?.origin).toBe(ORIGIN);
  });

  it('refuses an instance that cannot be chosen, without sending anything', async () => {
    const { env, accounts, dispatch } = makeEnv({ origin: null, instances: { mode: 'open' } });

    const outcome = await loginForAuthorize(
      { instance: '', username: 'lain', password: 'pw' },
      env,
    );

    expect(outcome).toStrictEqual({
      kind: 'error',
      message: 'Enter an instance, like wired.example',
    });
    expect(accounts.list()).toHaveLength(0);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('leaves the session alone when the login is refused', async () => {
    mockRegistration({ appToken: { status: 400, body: { error: 'Invalid credentials' } } }, PAGE);
    const { env, dispatch } = makeEnv({});

    const outcome = await loginForAuthorize(
      { instance: '', username: 'lain', password: 'no' },
      env,
    );

    expect(outcome.kind).toBe('error');
    expect(dispatch).not.toHaveBeenCalled();
  });
});
