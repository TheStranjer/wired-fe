/**
 * The start menu's state (WFE-299): whether the `[≡ wired]` menu at the left
 * of the status line is open. `/start`, its hotkeys and a click on its button
 * all ask for the same transition. Not persisted and not synced: a menu never
 * outlives its page.
 */

/** The action that opens or closes the start menu. */
export type StartMenuAction = { readonly type: 'startMenu'; readonly open: boolean };

/** The part of the app state the start menu owns. */
export type StartMenuSlice = { readonly startMenu: boolean };

/** {@link state} after {@link action}; the same state when the menu already is as asked. */
export function startMenuReducer<S extends StartMenuSlice>(state: S, action: StartMenuAction): S {
  return state.startMenu === action.open ? state : { ...state, startMenu: action.open };
}
