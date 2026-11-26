/**
 * Tests that the name of the command line's suggestion list goes through
 * `t()` (WFE-318, decision 19): under a fake language the list is announced
 * by the fake name. Startup is mocked; it has its own tests.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { I18nProvider } from '../i18n/I18nProvider';
import { initialAppState } from '../state/appState';
import { type AppAction, appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { installFakeLocale } from '../test/i18n';
import { server } from '../test/server';
import type { WindowRef } from '../windows/model';

vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

const ORIGIN = 'https://wired.example';

const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'not-a-real-token',
  refreshToken: null,
  expiresAt: null,
};

/** The home window of the session. */
const HOME: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };

/** A session signed in, with one home window. */
const SEED: readonly AppAction[] = [
  { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
  { type: 'windows', action: { type: 'open', ref: HOME, title: 'home' } },
];

describe('the suggestion list in another language', () => {
  it('is named in the language in use', () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/timelines/home`, () => HttpResponse.json([])),
      http.get(`${ORIGIN}/api/v1/custom_emojis`, () => HttpResponse.json([])),
    );
    installFakeLocale({ app: { command_suggestions: 'Sugerencias' } });
    render(
      <I18nProvider>
        <AppStateProvider initial={SEED.reduce(appReducer, initialAppState())}>
          <Root />
        </AppStateProvider>
      </I18nProvider>,
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Command line' }), {
      target: { value: '/ho' },
    });

    expect(screen.getByRole('listbox', { name: 'Sugerencias' })).toBeInTheDocument();
  });
});
