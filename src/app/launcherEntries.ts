/**
 * The rows of the view list an empty desktop offers (WFE-298): the pane menus'
 * own rows less the two that need a pane or a window already open. `Attach
 * media…` opens no view, and `Existing window…` would pull in a window from
 * another desktop, which the launcher never does. Pure.
 */

import type { PaneMenuEntry } from './paneMenu';

/** {@link entries} without `Attach media…` and `Existing window…`. */
export function launcherEntries(entries: readonly PaneMenuEntry[]): readonly PaneMenuEntry[] {
  return entries.filter((entry) => entry.id !== 'attach' && entry.pick !== 'window');
}
