/**
 * The second level of the `Existing window…` row (WFE-270) in the pane split
 * and pop-out menus: one row per open window other than the pane's own, read
 * `3 · #rust`, with the account when more than one is signed in, and the
 * command line a chosen row runs. Pure.
 */

import type { ViewCommand } from './paneMenu';
import { accountLabel } from './StatusBar';
import type { AppState } from '../state/appState';
import type { MenuItem } from '../ui/menuNav';

/** What every window row's id starts with; the rest is the window's number. */
const PREFIX = 'win:';

/** The rows for the windows of {@link state} but {@link ownWindowId}, in window order. */
export function windowPickerItems(state: AppState, ownWindowId: string): readonly MenuItem[] {
  const several = state.accounts.length > 1;
  return state.windows.windows
    .map((win, index) => ({ win, number: index + 1 }))
    .filter(({ win }) => win.id !== ownWindowId)
    .map(({ win, number }): MenuItem => {
      const account = several ? accountLabel(state, win.ref.accountKey) : null;
      const parts = [String(number), win.title, ...(account === null ? [] : [account])];
      return { id: `${PREFIX}${String(number)}`, label: parts.join(' · ') };
    });
}

/** The line `/`{@link command}` win N` for the window row {@link id}, or null when {@link id} is not a window row. */
export function pickedWindowLine(id: string, command: ViewCommand): string | null {
  return id.startsWith(PREFIX) ? `/${command} win ${id.slice(PREFIX.length)}` : null;
}
