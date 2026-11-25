/**
 * Tests for the global header: `WIRED` at the left and the active account's
 * handle at the right, or a placeholder while nobody is signed in.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppHeader } from './AppHeader';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';

const ACCOUNT: StoredAccount = {
  key: accountKey('https://wired.example', '1'),
  origin: 'https://wired.example',
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'not-a-real-token',
  refreshToken: null,
  expiresAt: null,
};

describe(AppHeader, () => {
  it('shows the product name and the active account handle', () => {
    const state = appReducer(initialAppState(), {
      type: 'accounts',
      accounts: [ACCOUNT],
      activeKey: ACCOUNT.key,
    });

    render(
      <AppStateProvider initial={state}>
        <AppHeader />
      </AppStateProvider>,
    );

    expect(screen.getByText('WIRED')).toBeInTheDocument();
    expect(screen.getByText('@lain@wired.example')).toBeInTheDocument();
  });

  it('says there is no account when none is active', () => {
    render(
      <AppStateProvider initial={initialAppState()}>
        <AppHeader />
      </AppStateProvider>,
    );

    expect(screen.getByText('no account')).toBeInTheDocument();
  });
});
