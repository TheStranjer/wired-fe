/**
 * Tests for the password login (decision 8) over the shared MSW server: a
 * token that proves out is stored as the active account, the app comes from
 * the login's cache, and a refused app registration, refused credentials or
 * refused verification each come back as a message that does not contain the
 * password.
 */
import { describe, expect, it } from 'vitest';

import { createAccountStore } from './accountStore';
import { passwordLogin } from './passwordLogin';
import { createStore } from '../storage/store';
import { memoryBackend } from '../test/memoryBackend';
import { ORIGIN, mockRegistration } from '../test/registrationServer';

const PARAMS = {
  origin: ORIGIN,
  redirectUri: `${ORIGIN}/`,
  appName: 'WiredFE',
  username: 'lain',
  password: 'correct horse',
  now: 1_700_000_000_000,
};

/** Fresh in-memory stores. */
function makeStores() {
  const backend = memoryBackend();
  return {
    apps: createStore('apps', backend),
    accounts: createAccountStore(createStore('accounts', backend)),
  };
}

describe(passwordLogin, () => {
  it('stores the verified account as the active one', async () => {
    mockRegistration({ appToken: { body: { access_token: 'user-token', expires_in: 60 } } });
    const stores = makeStores();

    const outcome = await passwordLogin(stores, PARAMS);

    expect(outcome).toMatchObject({
      kind: 'ok',
      account: {
        key: `${ORIGIN}#109`,
        handle: 'lain@wired.example',
        token: 'user-token',
        expiresAt: PARAMS.now + 60_000,
      },
    });
    expect(stores.accounts.activeKey()).toBe(`${ORIGIN}#109`);
  });

  it.each([
    { name: 'the app registration', answers: { app: { status: 500, body: { error: 'down' } } } },
    {
      name: 'the credentials',
      answers: { appToken: { status: 400, body: { error: 'Invalid credentials' } } },
    },
    {
      name: 'the verification',
      answers: { verify: { status: 401, body: { error: 'The access token is invalid' } } },
    },
  ])('says so when $name are refused, and stores nothing', async ({ answers }) => {
    mockRegistration(answers);
    const stores = makeStores();

    const outcome = await passwordLogin(stores, PARAMS);

    const text = JSON.stringify(outcome);

    expect(text).toMatch(/^\{"kind":"error","message":"Login failed: HTTP \d+: /u);
    expect(text).not.toContain('correct horse');
    expect(stores.accounts.list()).toHaveLength(0);
  });
});
