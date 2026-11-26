/**
 * The language list's state (WFE-310): whether the list of UI languages is
 * open in the place of the start menu's views. The `Language…` row of the
 * start menu and `/lang --pick` (so its hotkeys) ask for the same
 * transition. Not persisted and not synced: a menu never outlives its page.
 */

/** The action that opens or closes the language list. */
export type LanguageMenuAction = { readonly type: 'languageMenu'; readonly open: boolean };

/** The part of the app state the language list owns. */
export type LanguageMenuSlice = { readonly languageMenu: boolean };

/** {@link state} after {@link action}; the same state when the list already is as asked. */
export function languageMenuReducer<S extends LanguageMenuSlice>(
  state: S,
  action: LanguageMenuAction,
): S {
  return state.languageMenu === action.open ? state : { ...state, languageMenu: action.open };
}
