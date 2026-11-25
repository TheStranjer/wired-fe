/**
 * The status line's entries (decisions 12 and 18): one entry per desktop with
 * the unread of the windows it shows, then the windows holding unread that no
 * pane or float of the active desktop shows, so IRC-style activity tracking
 * survives the tiling desktop. Pure: it reads the layout and the window list.
 */

import type { StatusLineDesktop, StatusLineWindow } from '../ui/statusLineTypes';
import { shownPanes } from '../windows/desktopPanes';
import type { Desktop } from '../windows/desktopPanes';
import { activeDesktop } from '../windows/desktops';
import type { DesktopsState } from '../windows/desktops';
import type { WindowsState } from '../windows/model';

/** The entries the status line lists. */
type StatusEntries = {
  readonly desktops: readonly StatusLineDesktop[];
  readonly windows: readonly StatusLineWindow[];
};

/** The ids of the windows {@link desktop} shows, each once. */
function shownIds(desktop: Desktop): ReadonlySet<string> {
  return new Set(shownPanes(desktop).map((pane) => pane.windowId));
}

/** One entry per desktop: its number, the unread of the windows it shows, and whether it is on screen. */
function desktopEntries(
  layout: DesktopsState,
  windows: WindowsState,
): readonly StatusLineDesktop[] {
  return layout.desktops.map((desktop, index) => {
    const ids = shownIds(desktop);
    const shown = windows.windows.filter((win) => ids.has(win.id));
    return {
      number: index + 1,
      unread: shown.reduce((sum, win) => sum + win.unread, 0),
      highlight: shown.some((win) => win.highlight),
      active: index === layout.active,
    };
  });
}

/** The windows with unread or a highlight that the active desktop does not show, numbered in display order. */
function hiddenEntries(layout: DesktopsState, windows: WindowsState): readonly StatusLineWindow[] {
  const ids = shownIds(activeDesktop(layout));
  return windows.windows
    .map((win, index) => ({
      number: index + 1,
      title: win.title,
      unread: win.unread,
      highlight: win.highlight,
      shown: ids.has(win.id),
    }))
    .filter((entry) => !entry.shown && (entry.unread > 0 || entry.highlight))
    .map(({ number, title, unread, highlight }) => ({ number, title, unread, highlight }));
}

/** The desktops, and the hidden windows with activity, as the status line lists them. */
export function statusEntries(layout: DesktopsState, windows: WindowsState): StatusEntries {
  return {
    desktops: desktopEntries(layout, windows),
    windows: hiddenEntries(layout, windows),
  };
}
