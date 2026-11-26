/**
 * Tests for the composer window in the running shell (WFE-198): `/composer`
 * opens a composer window (a float, by default), plain text typed
 * at the command line while it is focused lands in the composer's text instead
 * of posting, and a second `/composer` once the first holds a draft is a window
 * of its own. Startup is
 * mocked; the window's own behaviour is in src/features/composer.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { server } from '../test/server';

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

/** The command line. */
function commandLine(): HTMLElement {
  return screen.getByRole('combobox', { name: 'Command line' });
}

/** Render Root signed in as lain, focus on the command line. */
function renderSignedIn(): void {
  server.use(
    http.get(`${ORIGIN}/api/v1/custom_emojis`, () => {
      return HttpResponse.json([]);
    }),
  );
  const state = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT.key,
  });
  render(
    <AppStateProvider initial={state}>
      <Root />
    </AppStateProvider>,
  );
  act(() => {
    commandLine().focus();
  });
}

/** Type {@link text} at the command line and press Enter. */
function submit(text: string): void {
  fireEvent.change(commandLine(), { target: { value: text } });
  fireEvent.keyDown(commandLine(), { key: 'Enter' });
}

describe('the composer window in the shell', () => {
  it('opens on /composer, titled compose and posting as the active account', async () => {
    renderSignedIn();

    submit('/composer');

    await waitFor(() => {
      expect(commandLine()).toHaveValue('');
    });

    expect(screen.getByRole('combobox', { name: 'Post as' })).toHaveValue(ACCOUNT.key);
    expect(screen.getByRole('log', { name: 'compose' })).toBeInTheDocument();
  });

  it('takes the text typed at the command line into its textarea instead of posting', async () => {
    renderSignedIn();
    submit('/composer');
    await waitFor(() => {
      expect(commandLine()).toHaveValue('');
    });

    submit('first line');
    await waitFor(() => {
      expect(commandLine()).toHaveValue('');
    });
    submit('second line');
    await waitFor(() => {
      expect(commandLine()).toHaveValue('');
    });

    expect(screen.getByRole('textbox', { name: 'Post text' })).toHaveValue(
      'first line\nsecond line',
    );
  });

  it('opens a second composer as compose/2, with its own draft', async () => {
    renderSignedIn();
    submit('/composer');
    await waitFor(() => {
      expect(commandLine()).toHaveValue('');
    });
    submit('kept in the first');
    await waitFor(() => {
      expect(commandLine()).toHaveValue('');
    });

    submit('/composer');

    const second = await screen.findByRole('log', { name: 'compose/2' });

    expect(second).toBeInTheDocument();

    const [, fresh] = screen.getAllByRole('textbox', { name: 'Post text' });

    expect(fresh).toHaveValue('');
  });
});
