/**
 * Tests for attachments through the whole shell (WFE-126): choosing a file in
 * the hidden input uploads it, prints its lines and shows `[+N media]` in the
 * status line before the mode; the next plain-text post carries the pending
 * attachment's id and the group goes away with the list; /detach empties the
 * list, echoes, and leaves the next post without media. Startup is mocked.
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

/** The attachment the instance answers uploads with. */
const READY = {
  id: '12',
  type: 'image',
  url: `${ORIGIN}/media/12.png`,
  preview_url: null,
  remote_url: null,
  description: null,
  blurhash: null,
};

const CAPS: Capabilities = {
  backend: 'wired',
  maxCharacters: 500,
  maxMediaAttachments: 4,
  pollLimits: DEFAULT_POLL_LIMITS,
  features: new Set<FeatureFlag>([]),
};

/** A signed-in, detected session with its home window open and active. */
const SESSION: readonly AppAction[] = [
  { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
  { type: 'profile', profile: { origin: ORIGIN, title: 'wired.example', capabilities: CAPS } },
  { type: 'windows', action: { type: 'open', ref: HOME, title: 'home' } },
];

/** A fresh session moved along by {@link actions}. */
function stateAfter(actions: readonly AppAction[]): AppState {
  return actions.reduce(appReducer, initialAppState());
}

/** The post bodies the fake instance received, in arrival order. */
let posted: Record<string, unknown>[] = [];

/** The home window's feeds, the emoji list, one ready upload and every send. */
function serveInstance(): void {
  posted = [];
  server.use(
    http.get(`${ORIGIN}/api/v1/timelines/home`, () => HttpResponse.json([])),
    http.get(`${ORIGIN}/api/v1/custom_emojis`, () => HttpResponse.json([])),
    http.post(`${ORIGIN}/api/v2/media`, () => HttpResponse.json(READY)),
    http.post(`${ORIGIN}/api/v1/statuses`, async ({ request }) => {
      posted.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json(CREATED);
    }),
  );
}

/** Render Root over the {@link SESSION} actions. */
function renderRoot(): HTMLElement {
  const { container } = render(
    <AppStateProvider initial={stateAfter(SESSION)}>
      <Root />
    </AppStateProvider>,
  );
  act(() => {
    screen.getByRole('textbox', { name: 'Command line' }).focus();
  });
  return container;
}

/** Type {@link text} at the command line and press Enter. */
function submit(text: string): void {
  const line = screen.getByRole('textbox', { name: 'Command line' });
  fireEvent.change(line, { target: { value: text } });
  fireEvent.keyDown(line, { key: 'Enter' });
}

/** Choose one image file in the shell's hidden input. */
function attachOne(container: HTMLElement): void {
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('the shell rendered no file input');
  }
  Object.defineProperty(input, 'files', {
    value: [new File(['pixel'], 'pixel.png', { type: 'image/png' })],
    configurable: true,
  });
  fireEvent.change(input);
}

describe('attachments in the shell', () => {
  beforeEach(serveInstance);

  it('shows the pending count and posts the attachment ids', async () => {
    const container = renderRoot();

    attachOne(container);

    await screen.findByText('attached pixel.png (1/4)');

    expect(screen.getByText('[+1 media]')).toBeInTheDocument();

    submit('look at this');
    // The attachment has no description, so the media are reviewed first (WFE-290).
    const review = await screen.findByRole('dialog', { name: 'Describe media' });
    fireEvent.click(within(review).getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(posted).toStrictEqual([
        { status: 'look at this', visibility: 'public', media_ids: ['12'] },
      ]);
    });
    await waitFor(() => {
      expect(screen.queryByText('[+1 media]')).toBeNull();
    });

    expect(screen.getByText('uploading pixel.png…')).toBeInTheDocument();
  });

  it('detaches everything on /detach and posts without media', async () => {
    const container = renderRoot();

    attachOne(container);
    await screen.findByText('attached pixel.png (1/4)');

    submit('/detach');

    await screen.findByText('attachments cleared');

    expect(screen.queryByText('[+1 media]')).toBeNull();

    submit('never mind');

    await waitFor(() => {
      expect(posted).toStrictEqual([{ status: 'never mind', visibility: 'public' }]);
    });
  });
});
