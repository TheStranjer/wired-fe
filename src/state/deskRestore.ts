/**
 * The `restore` action (decision 17): startup puts a saved desk, as
 * ./deskSnapshot restored it, in place of the windows and the desktops. Each
 * restored window gets its own empty scrollback; what the status window has
 * printed stays.
 */
import { syncBuffers } from './appReducer';
import type { AppState } from './appState';
import type { DeskState } from './deskSnapshot';

/** Put the saved desk in place. */
export type RestoreAction = { readonly type: 'restore' } & DeskState;

/** {@link state} with its windows and desktops replaced by those of {@link action}. */
export function restoreReducer(state: AppState, action: RestoreAction): AppState {
  const buffers = syncBuffers(action.windows.windows, state.buffers);
  return { ...state, windows: action.windows, layout: action.layout, buffers };
}
