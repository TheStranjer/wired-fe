/**
 * Shared test helpers for the pane commands (`/unsplit`, `/only`): an app
 * state with three windows and a layout built by real layout actions, and a
 * command context whose `dispatch` runs the real app reducer, so a test sees
 * what the command did to the windows and the desktops together.
 */
import { fakeCommandContext } from './commandContext';
import type { CommandContext } from '../commands/types';
import { initialAppState } from '../state/appState';
import type { AppState } from '../state/appState';
import { thread } from '../state/layoutSyncFixtures';
import { appReducer } from '../state/reducer';
import type { LayoutAction } from '../windows/layoutAction';

/** Status, a and b open; one pane showing b, the last window opened. */
function threeWindows(): AppState {
  return ['a', 'b'].reduce<AppState>(
    (state, target) =>
      appReducer(state, {
        type: 'windows',
        action: { type: 'open', ref: thread(target), title: target },
      }),
    initialAppState(),
  );
}

/** {@link threeWindows} with each of {@link actions} applied to the layout, in order. */
export function appWithLayout(...actions: readonly LayoutAction[]): AppState {
  return actions.reduce<AppState>(
    (state, action) => appReducer(state, { type: 'layout', action }),
    threeWindows(),
  );
}

/** A command context over a state that moves with its own `dispatch`. */
export type LayoutHarness = {
  /** A context showing the state as it is now. */
  readonly context: () => CommandContext;
  /** The state as the commands run so far left it. */
  readonly state: () => AppState;
};

/** A {@link LayoutHarness} starting from {@link initial}. */
export function layoutHarness(initial: AppState): LayoutHarness {
  const box = { current: initial };
  return {
    context: () =>
      fakeCommandContext({
        state: box.current,
        windows: box.current.windows,
        dispatch: (action) => {
          box.current = appReducer(box.current, action);
        },
      }),
    state: () => box.current,
  };
}
