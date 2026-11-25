/**
 * The `/desktop` listing (decision 18): one line per desktop with its number,
 * how many panes and floats it holds and the windows they show, a `*` marking
 * the desktop on screen. Pure: it reads the layout and the window list.
 */

import type { Desktop } from '../windows/desktopPanes';
import { shownPanes } from '../windows/desktopPanes';
import type { DesktopsState } from '../windows/desktops';
import type { WindowsState } from '../windows/model';

/** `1 pane`, `2 panes`: the count with its noun. */
function paneCount(count: number): string {
  return `${String(count)} ${count === 1 ? 'pane' : 'panes'}`;
}

/** The titles of the windows {@link desktop} shows, each once, in pane order. */
function shownTitles(desktop: Desktop, windows: WindowsState): readonly string[] {
  const ids = new Set(shownPanes(desktop).map((pane) => pane.windowId));
  return [...ids].map((id) => windows.windows.find((win) => win.id === id)?.title ?? id);
}

/** One listing line: {@link label} (marker and number), pane count, then the window titles when there are any. */
function desktopLine(desktop: Desktop, label: string, windows: WindowsState): string {
  const count = shownPanes(desktop).length;
  const titles = shownTitles(desktop, windows);
  const shown = titles.length === 0 ? '' : `: ${titles.join(', ')}`;
  return `${label}: ${paneCount(count)}${shown}`;
}

/** One line per desktop, in order, `*` on the active one. */
export function desktopLines(layout: DesktopsState, windows: WindowsState): readonly string[] {
  return layout.desktops.map((desktop, index) => {
    const marker = index === layout.active ? '*' : ' ';
    return desktopLine(desktop, `${marker} ${String(index + 1)}`, windows);
  });
}
