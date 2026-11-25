/**
 * Tests for opening the composer window in the running shell (WFE-245):
 * `/compose` and its alias open a composer window filled with their argument
 * and clear the line, a second one while the first is still empty focuses it
 * instead, Ctrl+E moves the command line's own plain text into it — and leaves
 * a command where it is — and the navigation c chord opens it. Startup is
 * mocked; what the window sends is in Root.composer.post.test.tsx.
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
  return screen.getByRole('textbox', { name: 'Command line' });
}

/** The composer's post textarea. */
function postField(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Post text' });
}

/** Render Root signed in as lain, focus on the command line. */
function renderRoot(): HTMLElement {
  server.use(http.get(`${ORIGIN}/api/v1/custom_emojis`, () => HttpResponse.json([])));
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
  const line = commandLine();
  act(() => {
    line.focus();
  });
  return line;
}

/** Type {@link text} at the command line and press Enter. */
function submit(text: string): void {
  const line = commandLine();
  fireEvent.change(line, { target: { value: text } });
  fireEvent.keyDown(line, { key: 'Enter' });
}

describe('opening the composer window', () => {
  it('opens on /compose with its argument, and the line clears', async () => {
    renderRoot();

    submit('/compose so much to say');

    const field = await screen.findByRole('textbox', { name: 'Post text' });

    expect(field).toHaveValue('so much to say');
    expect(screen.getByRole('log', { name: 'compose' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();

    await waitFor(() => {
      expect(commandLine()).toHaveValue('');
    });
  });

  it('runs under its alias and opens empty without an argument', async () => {
    renderRoot();

    submit('/c');

    const field = await screen.findByRole('textbox', { name: 'Post text' });

    expect(field).toHaveValue('');
    expect(screen.getByText('0/500')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'local' })).toBeNull();
  });

  it('runs under the name /composer too', async () => {
    renderRoot();

    submit('/composer');

    const picker = await screen.findByRole('combobox', { name: 'Post as' });

    expect(picker).toHaveValue(ACCOUNT.key);
  });

  it('focuses the composer that is still empty instead of opening another', async () => {
    renderRoot();
    submit('/compose');
    await screen.findByRole('log', { name: 'compose' });

    submit('/compose second try');

    await waitFor(() => {
      expect(postField()).toHaveValue('second try');
    });

    expect(screen.queryByRole('log', { name: 'compose/2' })).toBeNull();
  });

  it('Ctrl+E moves the command line’s plain text into the composer', async () => {
    const line = renderRoot();

    fireEvent.change(line, { target: { value: 'a draft half typed' } });
    fireEvent.keyDown(line, { key: 'e', ctrlKey: true });

    const field = await screen.findByRole('textbox', { name: 'Post text' });

    expect(field).toHaveValue('a draft half typed');
    expect(commandLine()).toHaveValue('');
  });

  it('Ctrl+E over a command opens the composer empty and leaves the line', async () => {
    const line = renderRoot();

    fireEvent.change(line, { target: { value: '/help' } });
    fireEvent.keyDown(line, { key: 'e', ctrlKey: true });

    const field = await screen.findByRole('textbox', { name: 'Post text' });

    expect(field).toHaveValue('');
    expect(line).toHaveValue('/help');
  });

  it('opens on the navigation c chord', async () => {
    renderRoot();

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'c' });

    const log = await screen.findByRole('log', { name: 'compose' });

    expect(log).toBeInTheDocument();
  });
});
