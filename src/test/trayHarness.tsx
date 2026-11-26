/**
 * The fixtures shared by the shell's media tray tests (WFE-287): a signed-in
 * session with its home window open, the fake instance — one ready upload, alt
 * text puts and sends, each recorded in the order it arrived — and the helpers
 * that render Root, type a line and attach one picture. Test wiring only; no
 * assertion lives here beyond the setup's own sanity checks.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { ReactElement } from 'react';

import { stateAfter } from './appSessions';
import { ACCOUNT, choose, fileInput, ORIGIN, picture } from './attachmentHarness';
import { status } from './fixtures';
import { server } from './server';
import type { AppAction } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';

/** A signed-in session, its instance not detected (the default cap of 4), with its home window open and active. */
const SESSION: readonly AppAction[] = [
  { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
  {
    type: 'windows',
    action: {
      type: 'open',
      ref: { kind: 'home', accountKey: ACCOUNT.key, target: null },
      title: 'home',
    },
  },
];

/** What the instance saw, in arrival order: `put <id> <description>` and `post`. */
const SEEN: string[] = [];

/** What the instance has seen since {@link serveInstance} last ran. */
export function seen(): readonly string[] {
  return SEEN;
}

/**
 * The home feed, the emoji list, one ready upload with a thumbnail, alt-text
 * puts that answer {@link putStatus} and every send, recorded into {@link seen}.
 */
export function serveInstance(putStatus: number): void {
  SEEN.length = 0;
  server.use(
    http.get(`${ORIGIN}/api/v1/timelines/home`, () => HttpResponse.json([])),
    http.get(`${ORIGIN}/api/v1/custom_emojis`, () => HttpResponse.json([])),
    http.post(`${ORIGIN}/api/v2/media`, () =>
      HttpResponse.json({
        id: '12',
        type: 'image',
        url: `${ORIGIN}/media/12.png`,
        preview_url: `${ORIGIN}/media/12-small.png`,
        remote_url: null,
        description: null,
        blurhash: null,
      }),
    ),
    http.put(`${ORIGIN}/api/v1/media/:id`, async ({ params, request }) => {
      const body = (await request.json()) as { readonly description: string };
      SEEN.push(`put ${String(params['id'])} ${body.description}`);
      return putStatus === 200
        ? HttpResponse.json({ id: '12', type: 'image', url: `${ORIGIN}/media/12.png` })
        : HttpResponse.json({ error: 'boom' }, { status: putStatus });
    }),
    http.post(`${ORIGIN}/api/v1/statuses`, () => {
      SEEN.push('post');
      return HttpResponse.json(status('42', { content: '<p>a new lament</p>' }));
    }),
  );
}

/** Render {@link shell} (the app's Root) over {@link SESSION}, with the command line focused. */
export function renderShell(shell: ReactElement): HTMLElement {
  const { container } = render(
    <AppStateProvider initial={stateAfter(SESSION)}>{shell}</AppStateProvider>,
  );
  act(() => {
    screen.getByRole('textbox', { name: 'Command line' }).focus();
  });
  return container;
}

/** Type {@link text} at the command line and press Enter. */
export function submit(text: string): void {
  const line = screen.getByRole('textbox', { name: 'Command line' });
  fireEvent.change(line, { target: { value: text } });
  fireEvent.keyDown(line, { key: 'Enter' });
}

/** Choose one image in the shell's hidden file input and wait for its tray list. */
export async function attachOne(container: HTMLElement): Promise<HTMLElement> {
  choose(fileInput(container), [picture('pixel.png')]);
  await screen.findByText('attached pixel.png (1/4)');
  return screen.getByRole('list', { name: 'Pending media' });
}
