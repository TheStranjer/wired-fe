/**
 * The session the `/pop` tests share (WFE-241, WFE-291): lain's home window
 * showing post `a`, driven through the real reducer, with the commands a test
 * hands in as the registry and a `print` spy. {@link fillThread},
 * {@link focusHomeBeside} and {@link shownIds} set up and read the desktop the
 * thread cases need.
 */

import { type Mock, vi } from 'vitest';

import { fakeCommandContext } from './commandContext';
import { status } from './fixtures';
import { ORIGIN, homeContext } from './homeWindow';
import type { CommandContext, CommandDefinition } from '../commands/types';
import type { AppState } from '../state/appState';
import { type AppAction, appReducer } from '../state/reducer';
import { shownPanes } from '../windows/desktopPanes';
import { activeDesktop } from '../windows/desktops';
import { windowId } from '../windows/model';

/** The thread window of post `a`, as `/thread` ids it for lain's account. */
export const THREAD_A = windowId({ kind: 'thread', accountKey: `${ORIGIN}#1`, target: 'a' });

/** Lain's home window, which a session starts in. */
export const HOME_ID = windowId({ kind: 'home', accountKey: `${ORIGIN}#1`, target: null });

/** A session over the home window: commands move it through the real reducer. */
export type PopSession = {
  readonly context: () => CommandContext;
  readonly state: () => AppState;
  readonly dispatch: (action: AppAction) => void;
  readonly print: Mock<CommandContext['print']>;
};

/** A session over the home window showing post `a`, whose commands are {@link definitions}. */
export function popSession(
  definitions: readonly CommandDefinition[],
  selectedId: string | null,
): PopSession {
  const box = { current: homeContext([status('a')], selectedId).state };
  const print = vi.fn<CommandContext['print']>();
  const dispatch = (action: AppAction): void => {
    box.current = appReducer(box.current, action);
  };
  return {
    context: () =>
      fakeCommandContext({
        state: box.current,
        windows: box.current.windows,
        registry: {
          commands: definitions,
          byName: new Map(definitions.map((definition) => [definition.name, definition])),
        },
        print,
        dispatch,
        dispatchWindows: (action) => {
          dispatch({ type: 'windows', action });
        },
      }),
    state: () => box.current,
    dispatch,
    print,
  };
}

/** The ids of every window shown on the active desktop, tiled first, then floats bottom to top. */
export function shownIds(state: AppState): string[] {
  return shownPanes(activeDesktop(state.layout)).map((pane) => pane.windowId);
}

/** Fills the thread window of post `a` with two posts, so it has labels of its own. */
export function fillThread(run: PopSession): void {
  run.dispatch({
    type: 'statuses',
    windowId: THREAD_A,
    statuses: [status('b'), status('a')],
    where: 'newer',
  });
}

/** Splits a new focused pane off showing the home window, so a thread shown beside it is not focused. */
export function focusHomeBeside(run: PopSession): void {
  run.dispatch({ type: 'layout', action: { type: 'split', dir: 'row', windowId: HOME_ID } });
}
