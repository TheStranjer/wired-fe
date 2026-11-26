/**
 * Tests for what the composer window sends from the shell (WFE-245): `/compose`
 * opens a window whose send posts as its account and clears the fields, keeping
 * the window; a failure comes back inside the window with the draft kept; and
 * the account's instance decides the counter's limit and whether the local
 * audience is offered (decision 5). Startup is mocked.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
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

/** What the instance answers a send with. */
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
  return screen.getByRole('combobox', { name: 'Command line' });
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

/** The custom emoji list a signed-in session asks for. */
function serveEmoji(): void {
  server.use(http.get(`${ORIGIN}/api/v1/custom_emojis`, () => HttpResponse.json([])));
}

describe('the composer window sending', () => {
  beforeEach(serveEmoji);

  it('posts as the account, then clears the fields and keeps the window', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/statuses`, () => {
        return HttpResponse.json(CREATED);
      }),
    );
    renderRoot(SIGNED_IN);

    submit('/compose hello');
    fireEvent.click(await screen.findByRole('button', { name: '[ send ]' }));

    const posted = await screen.findByText(/Posted as/u);

    expect(posted).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Post text' })).toHaveValue('');
    expect(screen.getByRole('log', { name: 'compose' })).toBeInTheDocument();
  });

  it('shows a refused send inside the window and keeps the draft', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/statuses`, () => {
        return HttpResponse.json({ error: 'boom' }, { status: 500 });
      }),
    );
    renderRoot(SIGNED_IN);

    submit('/compose shout');
    fireEvent.click(await screen.findByRole('button', { name: '[ send ]' }));

    const failure = await screen.findByText(/HTTP 500/u);

    expect(failure).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Post text' })).toHaveValue('shout');
  });

  it('reaches the window the instance’s limit and audiences', async () => {
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
    expect(screen.getByText('31/30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '[ send ]' })).toBeDisabled();
  });
});
