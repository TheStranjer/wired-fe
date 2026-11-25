/**
 * Tests for /pop (WFE-241): the post a label names, or the selected one, opens
 * its thread window in a new focused float titled `thread/<label>`, exactly as
 * `/float thread <label>` does, and the refusals are the thread command's. The
 * navigation `p` binding is checked against the real keymap in
 * src/keys/keymap.pop.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { command as float } from './float';
import { command } from './pop';
import { command as thread } from './thread';
import type { AppState } from '../../state/appState';
import { type AppAction, appReducer } from '../../state/reducer';
import { fakeCommandContext } from '../../test/commandContext';
import { status } from '../../test/fixtures';
import { ORIGIN, homeContext } from '../../test/homeWindow';
import { activeDesktop } from '../../windows/desktops';
import { windowId } from '../../windows/model';
import type { CommandContext } from '../types';

/** The thread window of post `a`, as `/thread` ids it for lain's account. */
const THREAD_A = windowId({ kind: 'thread', accountKey: `${ORIGIN}#1`, target: 'a' });

/** The commands a session runs `/pop` against. */
const DEFINITIONS = [float, thread];

/** A session over the home window showing post `a`, which the commands move through the real reducer. */
function session(selectedId: string | null): {
  readonly context: () => CommandContext;
  readonly state: () => AppState;
} {
  const box = { current: homeContext([status('a')], selectedId).state };
  const dispatch = (action: AppAction): void => {
    box.current = appReducer(box.current, action);
  };
  return {
    context: () =>
      fakeCommandContext({
        state: box.current,
        windows: box.current.windows,
        registry: {
          commands: DEFINITIONS,
          byName: new Map(DEFINITIONS.map((definition) => [definition.name, definition])),
        },
        dispatch,
        dispatchWindows: (action) => {
          dispatch({ type: 'windows', action });
        },
      }),
    state: () => box.current,
  };
}

/** The title of the window {@link id} in {@link state}. */
function titleOf(state: AppState, id: string): string | undefined {
  return state.windows.windows.find((win) => win.id === id)?.title;
}

describe('/pop', () => {
  it('pops the post a label names into a new focused float titled after it', async () => {
    const run = session(null);

    await expect(command.run('a0', run.context())).resolves.toStrictEqual({ ok: true });

    const { floats, focusedPaneId } = activeDesktop(run.state().layout);

    expect(floats.map((item) => item.windowId)).toStrictEqual([THREAD_A]);
    expect(focusedPaneId).toBe(floats[0]?.paneId);
    expect(titleOf(run.state(), THREAD_A)).toBe('thread/a0');
  });

  it('pops the selected post when no label is given', async () => {
    const run = session('a');

    await expect(command.run('  ', run.context())).resolves.toStrictEqual({ ok: true });

    expect(activeDesktop(run.state().layout).floats.map((item) => item.windowId)).toStrictEqual([
      THREAD_A,
    ]);
    expect(titleOf(run.state(), THREAD_A)).toBe('thread/a0');
  });

  it('refuses with nothing selected and no label, floating nothing', async () => {
    const run = session(null);

    await expect(command.run('', run.context())).resolves.toStrictEqual({
      ok: false,
      message: 'Select a post first (j/k) or give a label',
    });
    expect(activeDesktop(run.state().layout).floats).toStrictEqual([]);
  });

  it('refuses a label the window never gave', async () => {
    const run = session(null);

    await expect(command.run('a9', run.context())).resolves.toStrictEqual({
      ok: false,
      message: 'No post a9 here',
    });
  });

  it('declares its usage, its summary naming the hotkey and the navigation p binding', () => {
    expect(command.usage).toBe('/pop [label]');
    expect(command.summary).toContain('hotkey p');
    expect(command.bindings).toStrictEqual([{ mode: 'navigation', chord: 'p', args: '' }]);
  });
});
