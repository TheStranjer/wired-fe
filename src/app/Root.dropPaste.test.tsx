/**
 * Tests for paste and drop attaching through the whole shell (WFE-127): with
 * Root mounted, a paste carrying an image uploads it the way /attach does —
 * `uploading` and `attached` lines in the scrollback, `[+1 media]` in the
 * status line — while a text-only paste is left untouched: nothing printed, no
 * upload request. A file dragover raises the drop highlight; dropping an image
 * and a .txt uploads the image, takes the highlight away and prints the
 * refusal for the text file. jsdom carries no clipboard or data transfer, so
 * the events are built with stubbed ones. Startup is mocked.
 */
import { act, createEvent, fireEvent, render, screen, within } from '@testing-library/react';
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

/** How many uploads the fake instance has received since it started serving. */
let uploads = 0;

/** The home window's feeds, the emoji list and one ready upload. */
function serveInstance(): void {
  uploads = 0;
  server.use(
    http.get(`${ORIGIN}/api/v1/timelines/home`, () => HttpResponse.json([])),
    http.get(`${ORIGIN}/api/v1/custom_emojis`, () => HttpResponse.json([])),
    http.post(`${ORIGIN}/api/v2/media`, () => {
      uploads += 1;
      return HttpResponse.json(READY);
    }),
  );
}

/** Render Root over the {@link SESSION} actions. */
function renderRoot(): void {
  render(
    <AppStateProvider initial={stateAfter(SESSION)}>
      <Root />
    </AppStateProvider>,
  );
  act(() => {
    screen.getByRole('textbox', { name: 'Command line' }).focus();
  });
}

/** One file named {@link name} with mime type {@link type}. */
function fileNamed(name: string, type: string): File {
  return new File(['data'], name, { type });
}

/** Fire a paste on the window whose clipboard carries {@link files}. */
function firePaste(files: readonly File[]): Event {
  const event = createEvent.paste(window, { clipboardData: { files: [...files] } });
  fireEvent(window, event);
  return event;
}

/** Fire {@link type} on the window as a drag carrying {@link files}. */
function fireDrag(type: 'dragOver' | 'drop', files: readonly File[]): Event {
  const event = createEvent[type](window, { dataTransfer: { types: ['Files'], files } });
  fireEvent(window, event);
  return event;
}

/** The home window's scrollback region. */
function homeLog(): HTMLElement {
  return screen.getByRole('log', { name: 'home' });
}

describe('paste and drop in the shell', () => {
  beforeEach(serveInstance);

  it('uploads a pasted image and shows it pending', async () => {
    renderRoot();

    firePaste([fileNamed('pixel.png', 'image/png')]);

    await within(homeLog()).findByText('uploading pixel.png…');
    await within(homeLog()).findByText('attached pixel.png (1/4)');

    expect(screen.getByText('[+1 media]')).toBeInTheDocument();
    expect(uploads).toBe(1);
  });

  it('leaves a text-only paste alone: nothing printed, nothing uploaded', () => {
    renderRoot();
    const before = homeLog().textContent;

    const event = firePaste([]);

    expect(event.defaultPrevented).toBe(false);
    expect(homeLog().textContent).toBe(before);
    expect(uploads).toBe(0);
    expect(screen.queryByText('[+1 media]')).toBeNull();
  });

  it('raises the highlight for a file drag, uploads the image and refuses the text file', async () => {
    renderRoot();
    const image = fileNamed('pixel.png', 'image/png');
    const notes = fileNamed('notes.txt', 'text/plain');

    const over = fireDrag('dragOver', [image, notes]);

    expect(over.defaultPrevented).toBe(true);
    expect(screen.getByText('-- drop to attach --')).toBeInTheDocument();

    fireDrag('drop', [image, notes]);

    await within(homeLog()).findByText('attached pixel.png (1/4)');
    await within(homeLog()).findByText("Can't attach notes.txt: not an image, video or audio file");

    expect(screen.queryByText('-- drop to attach --')).toBeNull();
    expect(screen.getByText('[+1 media]')).toBeInTheDocument();
    expect(uploads).toBe(1);
  });
});
