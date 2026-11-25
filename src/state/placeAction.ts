/**
 * The `openPlaced` action (decision 13): open a window and show it where the
 * placement says, with the scrollbacks brought back to the shape of the list.
 * The transitions themselves are ./placement's.
 */
import { syncBuffers } from './appReducer';
import type { AppState } from './appState';
import { type OpenAction, type Placement, openPlaced } from './placement';

/** Open the window {@link action} names and place it as {@link placement} says. */
export type PlaceAction = {
  readonly type: 'openPlaced';
  readonly action: OpenAction;
  readonly placement: Placement;
};

/** {@link state} with the window opened and placed; the same state when nothing changes. */
export function placeReducer(state: AppState, action: PlaceAction): AppState {
  const { windows, layout } = openPlaced(state, action.action, action.placement);
  const buffers = syncBuffers(windows.windows, state.buffers);
  if (windows === state.windows && layout === state.layout && buffers === state.buffers) {
    return state;
  }
  return { ...state, windows, layout, buffers };
}
