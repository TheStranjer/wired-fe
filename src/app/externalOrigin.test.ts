/**
 * Tests for which instance an external-login route talks to: the build's own
 * when it fixes one, else the active account's, else the page's origin.
 */
import { describe, expect, it } from 'vitest';

import { externalOrigin } from './externalOrigin';
import { createAccountStore } from '../accounts/accountStore';
import { createStore } from '../storage/store';
import { memoryBackend } from '../test/memoryBackend';

/** A fresh account store. */
function makeAccounts() {
  return createAccountStore(createStore('accounts', memoryBackend()));
}

describe(externalOrigin, () => {
  it('is the build’s own instance when it fixes one', () => {
    const instances = { mode: 'fixed', origin: 'https://fixed.example' } as const;

    expect(externalOrigin(makeAccounts(), instances, 'https://page.example')).toBe(
      'https://fixed.example',
    );
  });

  it('falls back to the page when the visitor chooses and nobody is signed in', () => {
    const instances = { mode: 'open' } as const;

    expect(externalOrigin(makeAccounts(), instances, 'https://page.example')).toBe(
      'https://page.example',
    );
  });

  it('prefers the active account’s instance when the visitor chooses', () => {
    const accounts = makeAccounts();
    accounts.add({
      origin: 'https://other.example',
      accountId: '1',
      handle: 'lain@other.example',
      token: 't',
      refreshToken: null,
      expiresAt: null,
    });

    expect(externalOrigin(accounts, { mode: 'open' }, 'https://page.example')).toBe(
      'https://other.example',
    );
  });
});
