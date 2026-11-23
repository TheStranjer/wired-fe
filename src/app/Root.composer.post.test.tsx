/**
 * Tests for what the composer overlay posts (WFE-125): a send runs through
 * the active window's kind and closes the box, adding the created post to
 * that window's scrollback; an error string comes back shown inside the box
 * with the draft kept; the status window's refusal to post appears the same
 * way; and the active account's instance decides the counter's limit and
 * whether the local audience is offered (decision 5). Startup is mocked.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import type { Capabilities, FeatureFlag } from '../capabilities/capabilities';
import { DEFAULT_POLL_LIMITS } from '../capabilities/capabilities';
import { initialAppState } from '../state/appState';
import type { AppState } from '../state/appState';
import { type AppAction, appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { status } from '../test/fixtures';
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

const HOME: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };

/** What the home window's kind answers a send with. */
const CREATED = status('42', { content: '<p>a new lament</p>' });

/** A wired instance that serves local-only posts and caps posts at thirty. */
const CAPS: Capabilities = {
  backend: 'wired',
  maxCharacters: 30,
  maxMediaAttachments: 4,
  pollLimits: DEFAULT_POLL_LIMITS,
  features: new Set<FeatureFlag>(['localOnlyPosts']),
};

/** A session signed in as {@link ACCOUNT} with its instance detected. */
const SIGNED_IN: readonly AppAction[] = [
  { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
  { type: 'profile', profile: { origin: ORIGIN, title: 'wired.example', capabilities: CAPS } },
];

/** A fresh session moved along by {@link actions}. */
function stateAfter(actions: readonly AppAction[]): AppState {
  return actions.reduce(appReducer, initialAppState());
}

/** The command line. */
function commandLine(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Command line' });
}

/** Render Root over a session built from {@link actions}, focus on the line. */
function renderRoot(actions: readonly AppAction[]): HTMLElement {
  render(
    <AppStateProvider initial={stateAfter(actions)}>
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

/** The home timeline and custom emoji list a signed-in home window asks for. */
function serveHome(): void {
  server.use(
    http.get(`${ORIGIN}/api/v1/timelines/home`, () => HttpResponse.json([])),
    http.get(`${ORIGIN}/api/v1/custom_emojis`, () => HttpResponse.json([])),
  );
}

/** The signed-in home window the send tests post through. */
const HOME_WINDOW: readonly AppAction[] = [
  ...SIGNED_IN,
  { type: 'windows', action: { type: 'open', ref: HOME, title: 'home' } },
];

describe('the composer overlay posting', () => {
  beforeEach(serveHome);

  it('shows the active window’s refusal inside the box and keeps it open', async () => {
    renderRoot([]);

    submit('/compose shout');
    fireEvent.click(await screen.findByRole('button', { name: '[ send ]' }));

    const refusal = await screen.findByText("You can't post in this window. Try /home");

    expect(refusal).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('posts through the active home window and closes', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/statuses`, () => {
        return HttpResponse.json(CREATED);
      }),
    );
    renderRoot(HOME_WINDOW);

    submit('/compose hello');
    fireEvent.click(await screen.findByRole('button', { name: '[ send ]' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    const home = screen.getByRole('log', { name: 'home' });
    const posted = await within(home).findByText('a new lament');

    expect(posted).toBeInTheDocument();
  });

  it('reaches the box the instance’s limit and audiences', async () => {
    renderRoot(SIGNED_IN);

    submit('/compose');

    const counter = await screen.findByText('0/30');

    expect(counter).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'local' })).toBeInTheDocument();
  });

  it('reads the counter over the limit and keeps the send off', async () => {
    renderRoot(SIGNED_IN);

    submit(`/compose ${'x'.repeat(31)}`);

    const field = await screen.findByRole('textbox', { name: 'Post text' });

    expect(field).toHaveValue('x'.repeat(31));
    expect(within(screen.getByRole('dialog')).getByText('31/30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '[ send ]' })).toBeDisabled();
  });
});
