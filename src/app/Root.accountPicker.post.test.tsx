/**
 * The account picker in post mode, in the running shell (WFE-284): plain text
 * typed in a feed whose posting account nothing decides opens the `Post as`
 * dialog quoting it, and posts nothing yet. `Just this post` posts and keeps
 * no default; `For this feed` and `Everywhere` post and save one, so the next
 * line posts with no dialog. Cancel puts the text back on an empty command
 * line, and prints it when the reader has typed something since; a failed post
 * prints its error, raises the alert and gives the text back.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { initialAppState } from '../state/appState';
import { feedWindowOpen } from '../state/feedWindow';
import { type AppAction, appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { status } from '../test/fixtures';
import { server } from '../test/server';
import { ALICE, LAIN } from '../test/splitDesk';

/** Startup has its own tests; the shell tests do not boot the session. */
vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

const MAIN = { id: 'f1', name: 'main', sources: [] };

/** Two accounts, one feed and its window on screen. */
const FEED_DESK: readonly AppAction[] = [
  { type: 'accounts', accounts: [LAIN, ALICE], activeKey: LAIN.key },
  { type: 'settings', settings: { feeds: [MAIN] } },
  { type: 'windows', action: feedWindowOpen(MAIN) },
];

/** The texts the instance was asked to create. */
let created: string[] = [];

/** Render the shell over a session moved along by {@link actions}, the command line focused. */
function renderRoot(actions: readonly AppAction[]): void {
  render(
    <AppStateProvider initial={actions.reduce(appReducer, initialAppState())}>
      <Root />
    </AppStateProvider>,
  );
  act(() => {
    commandLine().focus();
  });
}

/** The command line, the shell's only textbox. */
function commandLine(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Command line' });
}

/** Types {@link text} at the command line and presses Enter. */
function submit(text: string): void {
  fireEvent.change(commandLine(), { target: { value: text } });
  fireEvent.keyDown(commandLine(), { key: 'Enter' });
}

/** Types {@link text} and waits for the picker it opens. */
async function askPicker(text: string): Promise<HTMLElement> {
  submit(text);
  const dialog = await screen.findByRole('dialog', { name: 'Post as' });
  await vi.waitFor(() => {
    expect(commandLine()).toHaveValue('');
  });
  return dialog;
}

/** Choose the radio named {@link name} in {@link dialog}, then OK. */
function answer(dialog: HTMLElement, name: string, account = '1'): void {
  fireEvent.keyDown(within(dialog).getAllByRole('radio')[0] ?? dialog, { key: account });
  fireEvent.click(within(dialog).getByRole('radio', { name }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
}

/** The feed window's scrollback. */
function feedLog(): HTMLElement {
  return screen.getByRole('log', { name: 'feed' });
}

describe('the account picker in post mode', () => {
  beforeEach(() => {
    created = [];
    server.use(
      http.get('https://wired.example/api/v1/custom_emojis', () => HttpResponse.json([])),
      http.post('https://wired.example/api/v1/statuses', async ({ request }) => {
        const body: unknown = await request.json();
        if (typeof body === 'object' && body !== null && 'status' in body) {
          created.push(String(body.status));
        }
        return HttpResponse.json(status('42'));
      }),
    );
  });

  it('opens on plain text with nobody to post as, quoting it, and posts nothing yet', async () => {
    renderRoot(FEED_DESK);

    const dialog = await askPicker('hello');

    expect(dialog).toHaveAccessibleDescription('“hello”');
    expect(within(dialog).getByRole('radio', { name: 'Just this post' })).toBeChecked();
    expect(within(dialog).getByRole('radio', { name: 'For this feed (~main)' })).not.toBeChecked();
    expect(within(dialog).getByRole('radio', { name: 'Everywhere' })).not.toBeChecked();
    expect(created).toStrictEqual([]);
  });

  it('cuts a long quote with an ellipsis', async () => {
    renderRoot(FEED_DESK);

    const dialog = await askPicker('x'.repeat(80));

    expect(dialog).toHaveAccessibleDescription(`“${'x'.repeat(59)}…”`);
  });

  it('posts as the chosen account on Just this post, and asks again next time', async () => {
    renderRoot(FEED_DESK);
    const dialog = await askPicker('hello');

    answer(dialog, 'Just this post', '2');

    await within(feedLog()).findByText('posted as @alice@wired.example');

    expect(created).toStrictEqual(['hello']);
    expect(screen.queryByRole('dialog')).toBeNull();

    submit('again');

    const again = await screen.findByRole('dialog', { name: 'Post as' });

    expect(again).toBeInTheDocument();
    expect(created).toStrictEqual(['hello']);
  });

  it('posts and saves the feed default on For this feed, so the next line posts at once', async () => {
    renderRoot(FEED_DESK);
    const dialog = await askPicker('hello');

    answer(dialog, 'For this feed (~main)', '2');

    await within(feedLog()).findByText('posted as @alice@wired.example');

    submit('again');

    await vi.waitFor(() => {
      expect(created).toStrictEqual(['hello', 'again']);
    });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('posts and saves the global default on Everywhere, so the next line posts at once', async () => {
    renderRoot(FEED_DESK);
    const dialog = await askPicker('hello');

    answer(dialog, 'Everywhere');

    await within(feedLog()).findByText('posted as @lain@wired.example');

    submit('/postas');

    const reopened = await screen.findByRole('dialog', { name: 'Post as' });

    expect(reopened).toHaveAccessibleDescription(
      '~main posts as @lain@wired.example (global default)',
    );
  });

  it('posts nothing on Cancel and puts the text back on the empty command line', async () => {
    renderRoot(FEED_DESK);
    const dialog = await askPicker('hello');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(commandLine()).toHaveValue('hello');
    expect(created).toStrictEqual([]);
  });

  it('prints the text instead of overwriting a line typed meanwhile', async () => {
    renderRoot(FEED_DESK);
    const dialog = await askPicker('hello');

    fireEvent.change(commandLine(), { target: { value: 'typed meanwhile' } });
    fireEvent.keyDown(within(dialog).getAllByRole('radio')[0] ?? dialog, { key: 'Escape' });

    expect(commandLine()).toHaveValue('typed meanwhile');
    expect(feedLog()).toHaveTextContent('Not posted: hello');
  });

  it('prints the error, raises the alert and gives the text back when the post fails', async () => {
    server.use(
      http.post('https://wired.example/api/v1/statuses', () =>
        HttpResponse.json({ error: 'Text is too long' }, { status: 422 }),
      ),
    );
    renderRoot(FEED_DESK);
    const dialog = await askPicker('hello');

    answer(dialog, 'Just this post');

    const alert = await screen.findByRole('alertdialog', { name: 'Error' });

    expect(alert).toHaveAccessibleDescription('HTTP 422: Text is too long');
    expect(feedLog()).toHaveTextContent('HTTP 422: Text is too long');
    expect(commandLine()).toHaveValue('hello');
  });
});
