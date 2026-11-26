/**
 * The rows of the view lists that open a view in a new place (WFE-298,
 * WFE-299): the pane menus' own rows less the ones that need a pane or a
 * window already open. `Attach media…` opens no view, and `Existing window…`
 * would pull in a window from another desktop, which the launcher never does.
 * The start menu also drops `Same window`, which would run a bare `/float` on
 * the focused pane instead of opening a view. Pure.
 */

import type { PaneMenuEntry } from './paneMenu';

/** {@link entries} without `Attach media…` and `Existing window…`. */
export function launcherEntries(entries: readonly PaneMenuEntry[]): readonly PaneMenuEntry[] {
  return entries.filter((entry) => entry.id !== 'attach' && entry.pick !== 'window');
}

/** {@link launcherEntries} of {@link entries} without `Same window` too: the rows of the start menu. */
export function startMenuEntries(entries: readonly PaneMenuEntry[]): readonly PaneMenuEntry[] {
  return launcherEntries(entries).filter((entry) => entry.id !== 'same');
}
