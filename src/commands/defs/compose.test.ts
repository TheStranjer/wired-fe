/**
 * Tests for /compose (WFE-245): the definition the command line, /help,
 * completion and the keymap read — alias c, the insert-mode Ctrl+E chord and
 * the navigation-mode c chord — and what a run does over the real app reducer:
 * it opens a composer window holding the text it was given, floated unless
 * `--in` or the settings say otherwise, focuses a composer whose draft is
 * empty rather than opening another, takes the command line's own plain text
 * when it has no argument, and refuses when nobody is signed in.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './compose';
import { type AppState, initialAppState } from '../../state/appState';
import { composerFields } from '../../state/composerActions';
import { type AppAction, appReducer } from '../../state/reducer';
import { fakeCommandContext } from '../../test/commandContext';
import { LAIN } from '../../test/splitDesk';
import { activeDesktop } from '../../windows/desktops';
import { STATUS_WINDOW_ID, windowId } from '../../windows/model';
import type { CommandContext, CommandOutcome } from '../types';

/** The window id of the first composer of {@link LAIN}. */
const FIRST = windowId({ kind: 'composer', accountKey: LAIN.key, target: '1' });

/** A running session signed in as lain: `/compose` runs against its state, which it moves. */
type Session = {
  readonly state: () => AppState;
  readonly setInput: ReturnType<typeof vi.fn<(text: string) => void>>;
  readonly run: (args: string, extra?: Partial<CommandContext>) => Promise<CommandOutcome>;
  readonly dispatch: (action: AppAction) => void;
};

/** A session signed in as lain whose command line holds {@link line}. */
function session(line = ''): Session {
  let state = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const dispatch = (action: AppAction): void => {
    state = appReducer(state, action);
  };
  const setInput = vi.fn<(text: string) => void>();
  return {
    state: () => state,
    setInput,
    dispatch,
    run: async (args, extra = {}) =>
      await command.run(
        args,
        fakeCommandContext({
          state,
          windows: state.windows,
          dispatch,
          dispatchWindows: (action) => {
            dispatch({ type: 'windows', action });
          },
          setInput,
          line,
          ...extra,
        }),
      ),
  };
}

/** The titles of the windows of {@link state}, in list order. */
function titles(state: AppState): readonly string[] {
  return state.windows.windows.map((win) => win.title);
}

describe('/compose', () => {
  it('declares its name, alias, grammar and hotkeys', () => {
    expect(command.name).toBe('compose');
    expect(command.aliases).toStrictEqual(['c', 'composer']);
    expect(command.usage).toBe('/compose [text] [--in <placement>]');
    expect(command.summary).toBe('Open a composer window');
    expect(command.bindings).toStrictEqual([
      { mode: 'insert', chord: 'Ctrl+e', args: '' },
      { mode: 'navigation', chord: 'c', args: '' },
    ]);
  });

  it('opens a composer window holding the text, floated by default and focused', async () => {
    const lain = session();

    await expect(lain.run('  so much to say ')).resolves.toStrictEqual({ ok: true });

    const state = lain.state();

    expect(titles(state)).toStrictEqual(['status', 'compose']);
    expect(state.windows.activeId).toBe(FIRST);
    expect(composerFields(state, FIRST).text).toBe('so much to say');
    expect(activeDesktop(state.layout).floats.map((float) => float.windowId)).toStrictEqual([
      FIRST,
    ]);
  });

  it('opens it empty when there is no text, leaving the draft untouched', async () => {
    const lain = session();

    await lain.run('');

    expect(titles(lain.state())).toStrictEqual(['status', 'compose']);
    expect(lain.state().composers.has(FIRST)).toBe(false);
    expect(lain.setInput).not.toHaveBeenCalled();
  });

  it('puts it in the focused pane when --in here says so', async () => {
    const lain = session();

    await lain.run('hello --in here');

    expect(composerFields(lain.state(), FIRST).text).toBe('hello');
    expect(activeDesktop(lain.state().layout).floats).toStrictEqual([]);
  });

  it('follows the openIn.composer setting over its own default', async () => {
    const lain = session();
    lain.dispatch({
      type: 'settings',
      settings: { openInByKind: { composer: 'vsplit' } },
    });

    await lain.run('');

    expect(activeDesktop(lain.state().layout).floats).toStrictEqual([]);
    expect(activeDesktop(lain.state().layout).tree?.type).toBe('split');
  });

  it('focuses the composer whose draft is empty instead of opening another', async () => {
    const lain = session();
    await lain.run('');
    lain.dispatch({ type: 'windows', action: { type: 'activate', id: STATUS_WINDOW_ID } });

    await lain.run('now with text');

    expect(titles(lain.state())).toStrictEqual(['status', 'compose']);
    expect(lain.state().windows.activeId).toBe(FIRST);
    expect(composerFields(lain.state(), FIRST).text).toBe('now with text');
  });

  it('opens a second composer once the first holds a draft', async () => {
    const lain = session();
    await lain.run('kept in the first');

    await lain.run('for the second');

    expect(titles(lain.state())).toStrictEqual(['status', 'compose', 'compose/2']);
    expect(composerFields(lain.state(), FIRST).text).toBe('kept in the first');
  });

  it('asks for the open itself, not a focus, when a split command holds the ask', async () => {
    const lain = session();
    await lain.run('');
    const dispatchWindows = vi.fn();

    await lain.run('', { placedByCaller: true, dispatchWindows });

    expect(dispatchWindows).toHaveBeenCalledWith({
      type: 'open',
      ref: { kind: 'composer', accountKey: LAIN.key, target: '1' },
      title: 'compose',
    });
  });

  it('takes the command line’s plain text when it has no argument, and empties the line', async () => {
    const lain = session('a draft half typed');

    await lain.run('');

    expect(composerFields(lain.state(), FIRST).text).toBe('a draft half typed');
    expect(lain.setInput).toHaveBeenCalledWith('');
  });

  it('takes nothing from the line for a split command, which opens the window later', async () => {
    const lain = session('a draft half typed');

    await lain.run('', { placedByCaller: true, dispatchWindows: vi.fn() });

    expect(lain.state().composers.has(FIRST)).toBe(false);
    expect(lain.setInput).not.toHaveBeenCalled();
  });

  it('leaves a command on the line where it is', async () => {
    const lain = session('/help');

    await lain.run('');

    expect(lain.state().composers.has(FIRST)).toBe(false);
    expect(lain.setInput).not.toHaveBeenCalled();
  });

  it('prefers its argument over the line and leaves the line alone', async () => {
    const lain = session('something else');

    await lain.run('the argument');

    expect(composerFields(lain.state(), FIRST).text).toBe('the argument');
    expect(lain.setInput).not.toHaveBeenCalled();
  });

  it('refuses without a signed-in account and opens nothing', async () => {
    const dispatchWindows = vi.fn();

    await expect(command.run('', fakeCommandContext({ dispatchWindows }))).resolves.toStrictEqual({
      ok: false,
      message: 'Not logged in. Type /connect',
    });

    expect(dispatchWindows).not.toHaveBeenCalled();
  });
});
