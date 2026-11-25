/**
 * Saving and restoring the desk (decision 17): {@link toSnapshot} turns the
 * open windows and the desktops into a {@link DeskSnapshot}, and
 * {@link fromSnapshot} turns one back into state, quietly dropping whatever no
 * longer fits: windows of accounts that are not signed in, the panes and
 * floats that showed them, and anything that does not hold together. Buffers,
 * unread counts and scroll positions are never saved. Pure; never throws.
 */
import { DESK_VERSION } from './deskSchema';
import type { DeskSnapshot } from './deskSchema';
import type { StoredAccount } from '../accounts/accountStore';
import { findPlaced, removeDesktopPane, shownPanes } from '../windows/desktopPanes';
import type { Desktop } from '../windows/desktopPanes';
import { focusedWindowId, initialDesktops } from '../windows/desktops';
import type { DesktopsState } from '../windows/desktops';
import { clampRect } from '../windows/floats';
import { STATUS_WINDOW_ID, initialWindowsState, withActive } from '../windows/model';
import type { DisplayOverrides, WindowState, WindowsState } from '../windows/model';

/** The two halves of the app state a desk is made of. */
export type DeskState = {
  readonly windows: WindowsState;
  readonly layout: DesktopsState;
};

/** The snapshot of {@link state} taken at {@link now} (ms since the epoch). */
export function toSnapshot(state: DeskState, now: number): DeskSnapshot {
  return {
    version: DESK_VERSION,
    updatedAt: now,
    windows: state.windows.windows
      .filter((win) => win.id !== STATUS_WINDOW_ID)
      .map(({ id, title, ref, display }) => ({ id, title, ref, display })),
    layout: {
      desktops: state.layout.desktops,
      active: state.layout.active,
      nextPaneSeq: state.layout.nextPaneSeq,
    },
  };
}

/** {@link saved} without its unset keys, which `exactOptionalPropertyTypes` tells apart from absent ones. */
function cleanDisplay(saved: DeskSnapshot['windows'][number]['display']): DisplayOverrides {
  const { density, avatars, images } = saved;
  return {
    ...(density === undefined ? {} : { density }),
    ...(avatars === undefined ? {} : { avatars }),
    ...(images === undefined ? {} : { images }),
  };
}

/** The saved windows that can be opened again: not the status window, once each, only for signed-in accounts. */
function keptWindows(
  saved: DeskSnapshot['windows'],
  accounts: readonly StoredAccount[],
): readonly WindowState[] {
  const signedIn = new Set(accounts.map((account) => account.key));
  return saved
    .filter((win, i) => saved.findIndex((other) => other.id === win.id) === i)
    .filter((win) => win.id !== STATUS_WINDOW_ID && win.ref.kind !== 'status')
    .filter((win) => win.ref.accountKey === null || signedIn.has(win.ref.accountKey))
    .map((win) => ({
      id: win.id,
      ref: win.ref,
      title: win.title,
      unread: 0,
      highlight: false,
      display: cleanDisplay(win.display),
    }));
}

/** The desktop with every pane showing a window outside {@link shown} closed, its floats clamped and a focus that exists. */
function tidyDesktop(
  saved: DeskSnapshot['layout']['desktops'][number],
  shown: ReadonlySet<string>,
): Desktop {
  const floats = saved.floats.map((float) => ({ ...float, rect: clampRect(float.rect) }));
  const loaded: Desktop = { tree: saved.tree, floats, focusedPaneId: saved.focusedPaneId };
  const trimmed = shownPanes(loaded)
    .filter((pane) => !shown.has(pane.windowId))
    .reduce((rest, pane) => removeDesktopPane(rest, pane.paneId), loaded);
  const { focusedPaneId } = trimmed;
  if (focusedPaneId !== null && findPlaced(trimmed, focusedPaneId) !== null) {
    return trimmed;
  }
  return { ...trimmed, focusedPaneId: shownPanes(trimmed)[0]?.paneId ?? null };
}

/** The number a pane id `p<n>` counts, or 0 for any other id. */
function paneSeq(paneId: string): number {
  const match = /^p(\d+)$/.exec(paneId);
  return match?.[1] === undefined ? 0 : Number(match[1]);
}

/** The desktops as state: the saved active one kept in range, and the pane counter past every pane id; the status-only desk when pane ids repeat. */
function tidyLayout(saved: DeskSnapshot['layout'], shown: ReadonlySet<string>): DesktopsState {
  const desktops = saved.desktops.map((desktop) => tidyDesktop(desktop, shown));
  const ids = desktops.flatMap((desktop) => shownPanes(desktop).map((pane) => pane.paneId));
  if (new Set(ids).size !== ids.length) {
    return initialDesktops(STATUS_WINDOW_ID);
  }
  return {
    desktops,
    active: Math.min(saved.active, desktops.length - 1),
    nextPaneSeq: Math.max(saved.nextPaneSeq, ...ids.map((id) => paneSeq(id) + 1)),
  };
}

/**
 * The windows and desktops a snapshot restores to, given who is signed in. The
 * status window comes first, as always; the window of the focused pane is the
 * active one.
 */
export function fromSnapshot(
  snapshot: DeskSnapshot,
  accounts: readonly StoredAccount[],
): DeskState {
  const kept = keptWindows(snapshot.windows, accounts);
  const shown = new Set([STATUS_WINDOW_ID, ...kept.map((win) => win.id)]);
  const layout = tidyLayout(snapshot.layout, shown);
  const base = initialWindowsState();
  const windows = { ...base, windows: [...base.windows, ...kept] };
  const focused = focusedWindowId(layout);
  return { windows: focused === null ? windows : withActive(windows, focused), layout };
}
