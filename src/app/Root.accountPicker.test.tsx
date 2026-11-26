/**
 * The account picker in the running shell (WFE-282): bare `/postas` opens the
 * `Post as` dialog over the shell with focus in it, Escape closes it and hands
 * the keyboard back to the command line, OK saves the choice and prints the
 * confirmation line, nobody signed in is refused with the usual alert, and an
 * error alert raised meanwhile waits until the picker is closed.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { initialAppState } from '../state/appState';
import { feedWindowOpen } from '../state/feedWindow';
import { type AppAction, appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
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
  return screen.getByRole('combobox', { name: 'Command line' });
}

/** Types {@link text} at the command line and presses Enter. */
function submit(text: string): void {
  fireEvent.change(commandLine(), { target: { value: text } });
  fireEvent.keyDown(commandLine(), { key: 'Enter' });
}

/** The picker once it is up. */
async function picker(): Promise<HTMLElement> {
  return screen.findByRole('dialog', { name: 'Post as' });
}

describe('the account picker in the shell', () => {
  beforeEach(() => {
    server.use(http.get('https://wired.example/api/v1/custom_emojis', () => HttpResponse.json([])));
  });

  it('opens on /postas with focus on the chosen account, and Escape gives the keyboard back', async () => {
    renderRoot(FEED_DESK);

    submit('/postas');

    const dialog = await picker();

    expect(dialog).toHaveAccessibleDescription('No posting account set');
    expect(within(dialog).getByRole('radio', { name: '1. @lain@wired.example' })).toHaveFocus();

    fireEvent.keyDown(within(dialog).getByRole('radio', { name: '1. @lain@wired.example' }), {
      key: 'Escape',
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(commandLine()).toHaveFocus();
  });

  it('saves the feed default on OK, prints it, and describes it the next time', async () => {
    renderRoot(FEED_DESK);
    submit('/postas');
    const dialog = await picker();

    fireEvent.keyDown(within(dialog).getByRole('radio', { name: '1. @lain@wired.example' }), {
      key: '2',
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('log', { name: 'feed' })).toHaveTextContent(
      '~main posts as @alice@wired.example (feed default)',
    );

    submit('/postas');

    const reopened = await picker();

    expect(reopened).toHaveAccessibleDescription(
      '~main posts as @alice@wired.example (feed default)',
    );
  });

  it('saves the global default on OK with Everywhere', async () => {
    renderRoot(FEED_DESK);
    submit('/postas');
    const dialog = await picker();

    fireEvent.click(within(dialog).getByRole('radio', { name: 'Everywhere' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));

    expect(screen.getByRole('log', { name: 'feed' })).toHaveTextContent(
      'posts as @lain@wired.example (global default)',
    );
  });

  it('changes nothing on Cancel', async () => {
    renderRoot(FEED_DESK);
    submit('/postas');
    const dialog = await picker();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('log', { name: 'feed' })).not.toHaveTextContent('posts as');
  });

  it('refuses with the not-logged-in alert and opens no picker when nobody is signed in', async () => {
    renderRoot([]);

    submit('/postas');

    const alert = await screen.findByRole('alertdialog', { name: 'Error' });

    expect(alert).toHaveAccessibleDescription('Not logged in. Type /connect');
    expect(screen.queryByRole('dialog', { name: 'Post as' })).toBeNull();
  });

  it('holds an error alert back until the picker is closed', async () => {
    renderRoot(FEED_DESK);
    submit('/postas');
    const dialog = await picker();

    submit('/nosuch');

    await within(screen.getByRole('log', { name: 'feed' })).findByText(
      'Unknown command: /nosuch. Try /help',
    );

    expect(screen.queryByRole('alertdialog')).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('alertdialog', { name: 'Error' })).toBeInTheDocument();
  });
});
