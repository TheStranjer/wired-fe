/**
 * Tests for registering from an invite (decision 8) over the shared MSW
 * server: a registration whose token proves out is stored as the active
 * account, the invite travels as `token`, the app comes from the login's
 * cache, a response (or a refusal of the new token) that says the address
 * needs confirming or a moderator needs approving stores nothing, and every
 * refusal comes back as a message with its field errors.
 */
import { describe, expect, it } from 'vitest';

import { createAccountStore } from './accountStore';
import { type RegistrationOutcome, registerAccount } from './registerAccount';
import { createStore } from '../storage/store';
import { ORIGIN, mockRegistration } from '../test/registrationServer';

const REDIRECT_URI = `${ORIGIN}/`;
const NOW = 1_700_000_000_000;

/** Fresh in-memory stores, the account list readable through `accounts`. */
function makeStores() {
  const memory = new Map<string, string>();
  const backend = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  };
  return {
    apps: createStore('apps', backend),
    accounts: createAccountStore(createStore('accounts', backend)),
  };
}

/** Registers lain with invite `invite-1` on {@link stores}. */
async function register(stores: ReturnType<typeof makeStores>): Promise<RegistrationOutcome> {
  return registerAccount(stores, {
    origin: ORIGIN,
    redirectUri: REDIRECT_URI,
    appName: 'WiredFE',
    now: NOW,
    account: {
      username: 'lain',
      email: 'lain@example.com',
      password: 'correct horse',
      reason: '',
      locale: 'en',
      inviteToken: 'invite-1',
    },
  });
}

describe(registerAccount, () => {
  it('stores the verified account as the active one and sends the invite as token', async () => {
    const seen = mockRegistration({
      accounts: { body: { access_token: 'user-token', refresh_token: 'r-1', expires_in: 60 } },
    });
    const stores = makeStores();

    const outcome = await register(stores);

    const stored = {
      key: `${ORIGIN}#109`,
      origin: ORIGIN,
      accountId: '109',
      handle: 'lain@wired.example',
      token: 'user-token',
      refreshToken: 'r-1',
      expiresAt: NOW + 60_000,
    };

    expect(outcome).toStrictEqual({ kind: 'ok', account: stored });
    expect(stores.accounts.list()).toStrictEqual([stored]);
    expect(stores.accounts.activeKey()).toBe(stored.key);
    expect(seen.auth).toBe('Bearer app-token');
    expect(seen.body).toMatchObject({ agreement: true, token: 'invite-1', username: 'lain' });
  });

  it.each([
    ['approval is required', { approval_required: true }, 'approval'],
    ['confirmation is required', { confirmation_required: true }, 'confirmation'],
    ['it carries no token', {}, 'confirmation'],
  ])('stores nothing when the response says %s', async (_name, body, kind) => {
    mockRegistration({ accounts: { body } });
    const stores = makeStores();

    const outcome = await register(stores);

    expect(outcome).toStrictEqual({ kind });
    expect(stores.accounts.list()).toStrictEqual([]);
  });

  it.each([
    ['approval', 'Your login is currently pending approval', 'approval'],
    ['confirmation', 'Your login is missing a confirmed e-mail address', 'confirmation'],
  ])('reads a refused new token as %s', async (_name, error, kind) => {
    mockRegistration({ verify: { status: 403, body: { error } } });
    const stores = makeStores();

    const outcome = await register(stores);

    expect(outcome).toStrictEqual({ kind });
    expect(stores.accounts.list()).toStrictEqual([]);
  });

  it('reports a new token that fails otherwise', async () => {
    mockRegistration({ verify: { status: 500, body: { error: 'boom' } } });

    const outcome = await register(makeStores());

    expect(outcome).toStrictEqual({
      kind: 'error',
      message: 'Registered, but login failed: HTTP 500: boom',
      fields: {},
    });
  });

  it('reports a 422 with the instance’s field errors', async () => {
    mockRegistration({
      accounts: {
        status: 422,
        body: {
          error: 'Validation failed: Email has already been taken',
          details: { email: [{ error: 'ERR_TAKEN', description: 'has already been taken' }] },
        },
      },
    });

    const outcome = await register(makeStores());

    expect(outcome).toStrictEqual({
      kind: 'error',
      message: 'Registration failed: HTTP 422: Validation failed: Email has already been taken',
      fields: { email: ['has already been taken'] },
    });
  });

  it('reports an invalid invite', async () => {
    mockRegistration({ accounts: { status: 403, body: { error: 'Invite token is invalid' } } });

    const outcome = await register(makeStores());

    expect(outcome).toStrictEqual({
      kind: 'error',
      message: 'Registration failed: HTTP 403: Invite token is invalid',
      fields: {},
    });
  });

  it('reports a refused app registration and a refused app token', async () => {
    mockRegistration({ app: { status: 500, body: { error: 'no apps' } } });
    const apps = await register(makeStores());

    mockRegistration({ appToken: { status: 401, body: { error: 'bad client' } } });
    const token = await register(makeStores());

    expect(apps).toStrictEqual({
      kind: 'error',
      message: 'Registration failed: HTTP 500: no apps',
      fields: {},
    });
    expect(token).toStrictEqual({
      kind: 'error',
      message: 'Registration failed: HTTP 401: bad client',
      fields: {},
    });
  });

  it('reuses the app the login cached', async () => {
    mockRegistration({ app: { status: 500, body: { error: 'would fail if asked' } } });
    const stores = makeStores();
    stores.apps.set(`${ORIGIN} ${REDIRECT_URI}`, { client_id: 'cid', client_secret: 'csecret' });

    const outcome = await register(stores);

    expect(outcome.kind).toBe('ok');
  });
});
