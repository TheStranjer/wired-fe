/**
 * The pane lookup of one desktop (ARCHITECTURE.md decision 12): which pane or
 * float shows a given window. Pure.
 */
import { shownPanes } from './desktopPanes';
import type { Desktop } from './desktopPanes';

/** The id of the first pane or float of the desktop showing {@link windowId}, or null. */
export function paneShowing(desktop: Desktop, windowId: string): string | null {
  return shownPanes(desktop).find((pane) => pane.windowId === windowId)?.paneId ?? null;
}
