/**
 * Tests for /people: it opens the focused window's people window in a `row`
 * split to its right at ratio 0.8 with focus kept on the watched window, a
 * second call closes that pane again, and asking from a people window is
 * refused. The layout and window list are moved by the real reducers, so the
 * tests see what the shell would.
 */
import { describe, expect, it } from 'vitest';

import { command } from './people';
import { initialAppState } from '../../state/appState';
import type { AppState } from '../../state/appState';
import { peopleWindowId, peopleWindowOpen } from '../../state/peopleWindow';
import { appReducer } from '../../state/reducer';
import { DEFAULT_SETTINGS, type Settings } from '../../state/settings';
import { fakeCommandContext } from '../../test/commandContext';
import { activeDesktop, focusedWindowId } from '../../windows/desktops';
import { activeWindow, windowId } from '../../windows/model';
import type { WindowRef } from '../../windows/model';
import { panes } from '../../windows/splitTree';
import type { SplitTree } from '../../windows/splitTree';
import type { CommandContext } from '../types';

/** The window the tests watch. */
const NOTES: WindowRef = { kind: 'search', accountKey: null, target: 'notes' };

/** A session with {@link NOTES} open, shown and focused, under {@link settings}. */
function watching(settings: Settings = DEFAULT_SETTINGS): AppState {
  return appReducer(initialAppState(settings), {
    type: 'windows',
    action: { type: 'open', ref: NOTES, title: 'search/notes' },
  });
}

/** A context whose dispatches move {@link state} through the real reducers; `current` reads it back. */
function playing(state: AppState): { context: CommandContext; current: () => AppState } {
  let now = state;
  const context = fakeCommandContext({
    state,
    windows: state.windows,
    dispatch: (action) => {
      now = appReducer(now, action);
    },
    dispatchWindows: (action) => {
      now = appReducer(now, { type: 'windows', action });
    },
  });
  return { context, current: () => now };
}

/** The tree of the active desktop; the tests only call this for a desktop that has one. */
function treeOf(state: AppState): SplitTree {
  const { tree } = activeDesktop(state.layout);
  if (tree === null) {
    throw new Error('the desktop has no tree');
  }
  return tree;
}

describe('/people', () => {
  it('opens the people window of the focused window in a row split at 0.8', async () => {
    const { context, current } = playing(watching());

    await expect(command.run('', context)).resolves.toStrictEqual({ ok: true });

    const tree = treeOf(current());

    expect(tree).toMatchObject({ type: 'split', dir: 'row' });
    expect(tree.type === 'split' ? tree.ratio : 0).toBeCloseTo(0.8);
    expect(panes(tree).map((pane) => pane.windowId)).toStrictEqual([
      windowId(NOTES),
      peopleWindowId(activeWindow(context.windows)),
    ]);
  });

  it('titles the window people:<title> and keeps focus on the watched window', async () => {
    const { context, current } = playing(watching());

    await command.run('', context);

    expect(current().windows.windows.map((win) => win.title)).toStrictEqual([
      'status',
      'search/notes',
      'people:search/notes',
    ]);
    expect(current().windows.activeId).toBe(windowId(NOTES));
    expect(focusedWindowId(current().layout)).toBe(windowId(NOTES));
  });

  it('closes the people pane when it is already shown on the desktop', async () => {
    const opened = playing(watching());
    await command.run('', opened.context);
    const again = playing(opened.current());

    await expect(command.run('', again.context)).resolves.toStrictEqual({ ok: true });

    expect(treeOf(again.current())).toMatchObject({ type: 'pane', windowId: windowId(NOTES) });
    expect(again.current().windows.activeId).toBe(windowId(NOTES));
  });

  it('shows the people window again after the pane was toggled away, without a second window', async () => {
    const first = playing(watching());
    await command.run('', first.context);
    const second = playing(first.current());
    await command.run('', second.context);
    const third = playing(second.current());

    await command.run('', third.context);

    expect(panes(treeOf(third.current()))).toHaveLength(2);
    expect(third.current().windows.windows).toHaveLength(3);
  });

  it('refuses in a people window, changing nothing', async () => {
    const state = watching();
    const inPeople = appReducer(state, {
      type: 'windows',
      action: peopleWindowOpen(activeWindow(state.windows)),
    });
    const { context, current } = playing(inPeople);

    await expect(command.run('', context)).resolves.toStrictEqual({
      ok: false,
      message: 'A people window has no people of its own',
    });

    expect(current()).toBe(inPeople);
  });

  it('opens the people window where --in says, not in its own split', async () => {
    const { context, current } = playing(watching());

    await expect(command.run('--in float', context)).resolves.toStrictEqual({ ok: true });

    const { floats, tree } = activeDesktop(current().layout);

    expect(floats.map((float) => float.windowId)).toStrictEqual([
      peopleWindowId(activeWindow(context.windows)),
    ]);
    expect(tree).toMatchObject({ type: 'pane', windowId: windowId(NOTES) });
  });

  it('opens the people window where the people kind’s own setting says', async () => {
    const { context, current } = playing(
      watching({ ...DEFAULT_SETTINGS, openInByKind: { people: 'hidden' } }),
    );

    await command.run('', context);

    expect(current().windows.windows.map((win) => win.title)).toContain('people:search/notes');
    expect(current().windows.activeId).toBe(windowId(NOTES));
    expect(treeOf(current())).toMatchObject({ type: 'pane', windowId: windowId(NOTES) });
  });

  it('keeps its own split whatever the default placement is', async () => {
    const { context, current } = playing(watching({ ...DEFAULT_SETTINGS, openIn: 'float' }));

    await command.run('', context);

    expect(treeOf(current())).toMatchObject({ type: 'split', dir: 'row' });
    expect(activeDesktop(current().layout).floats).toHaveLength(0);
  });

  it('refuses a placement it does not know, changing nothing', async () => {
    const state = watching();
    const { context, current } = playing(state);

    await expect(command.run('--in sideways', context)).resolves.toStrictEqual({
      ok: false,
      message: '--in takes here|vsplit|split|float|hidden',
    });

    expect(current()).toBe(state);
  });

  it('is the /people command', () => {
    expect(command.name).toBe('people');
    expect(command.usage).toBe('/people');
  });
});
