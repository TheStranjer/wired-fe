/**
 * Pane-level transitions on a single desktop (ARCHITECTURE.md decision 12): a
 * split tree plus floats with one focused pane. Desktop-level state (the list
 * of desktops, the active one, pane id allocation) lives in desktops.ts. Pure:
 * every function returns the input unchanged when nothing applies, and pane
 * ids are passed in.
 */
import { addFloat, findFloat, raiseFloat, removeFloat } from './floats';
import type { FloatRect, Floats } from './floats';
import { findPane, singlePane } from './splitTree';
import type { PaneLeaf, SplitDir, SplitTree } from './splitTree';
import { closePane, splitPane } from './splitTreeOps';

/** One desktop: a split tree (null when empty), floats above it and the focused pane or float. */
export type Desktop = {
  readonly tree: SplitTree | null;
  readonly floats: Floats;
  readonly focusedPaneId: string | null;
};

/** A pane of a desktop wherever it sits: `rect` is null for a tree pane, its rectangle for a float. */
export type PlacedPane = {
  readonly paneId: string;
  readonly windowId: string;
  readonly rect: FloatRect | null;
};

/** A desktop with nothing on it. */
export const EMPTY_DESKTOP: Desktop = { tree: null, floats: [], focusedPaneId: null };

/** The pane or float with this id, wherever it sits on the desktop, or null. */
export function findPlaced(desktop: Desktop, paneId: string): PlacedPane | null {
  const leaf = desktop.tree === null ? null : findPane(desktop.tree, paneId);
  if (leaf !== null) {
    return { paneId, windowId: leaf.windowId, rect: null };
  }
  return findFloat(desktop.floats, paneId);
}

/** The window shown by the focused pane or float, or null. */
export function focusedWindow(desktop: Desktop): string | null {
  if (desktop.focusedPaneId === null) {
    return null;
  }
  return findPlaced(desktop, desktop.focusedPaneId)?.windowId ?? null;
}

/** The first pane in tree order. */
function firstPane(tree: SplitTree): PaneLeaf {
  return tree.type === 'pane' ? tree : firstPane(tree.a);
}

/** The last pane in tree order. */
function lastPane(tree: SplitTree): PaneLeaf {
  return tree.type === 'pane' ? tree : lastPane(tree.b);
}

/** The subtree that takes the place of the pane `paneId` when it closes, or null. */
function siblingOf(tree: SplitTree, paneId: string): SplitTree | null {
  if (tree.type === 'pane') {
    return null;
  }
  if (tree.a.type === 'pane' && tree.a.paneId === paneId) {
    return tree.b;
  }
  if (tree.b.type === 'pane' && tree.b.paneId === paneId) {
    return tree.a;
  }
  return siblingOf(tree.a, paneId) ?? siblingOf(tree.b, paneId);
}

/** The id of the topmost float, or null. */
function topFloatId(floats: Floats): string | null {
  return floats.at(-1)?.paneId ?? null;
}

/** Focuses the pane or float `paneId`, raising a float; unchanged when the desktop has neither. */
export function focusDesktopPane(desktop: Desktop, paneId: string): Desktop {
  if (findFloat(desktop.floats, paneId) !== null) {
    return { ...desktop, floats: raiseFloat(desktop.floats, paneId), focusedPaneId: paneId };
  }
  if (desktop.tree === null || findPane(desktop.tree, paneId) === null) {
    return desktop;
  }
  return desktop.focusedPaneId === paneId ? desktop : { ...desktop, focusedPaneId: paneId };
}

/**
 * Splits the focused tree pane (the last pane when a float or nothing has
 * focus) and focuses the new pane; an empty desktop gets its first pane.
 * Unchanged when `paneId` is already in the tree.
 */
export function splitDesktop(
  desktop: Desktop,
  dir: SplitDir,
  ...added: readonly [paneId: string, windowId: string]
): Desktop {
  const [paneId, windowId] = added;
  const { tree, focusedPaneId } = desktop;
  if (tree === null) {
    return { ...desktop, tree: singlePane(paneId, windowId), focusedPaneId: paneId };
  }
  const focused = focusedPaneId === null ? null : findPane(tree, focusedPaneId);
  const target = focused ?? lastPane(tree);
  const split = splitPane(tree, target.paneId, dir, paneId, windowId);
  return split === tree ? desktop : { ...desktop, tree: split, focusedPaneId: paneId };
}

/** Moves the focused tree pane into a float under the same pane id. */
export function floatDesktopPane(desktop: Desktop): Desktop {
  const { tree, focusedPaneId } = desktop;
  const leaf = tree === null || focusedPaneId === null ? null : findPane(tree, focusedPaneId);
  if (tree === null || leaf === null) {
    return desktop;
  }
  return {
    ...desktop,
    tree: closePane(tree, leaf.paneId),
    floats: addFloat(desktop.floats, leaf.paneId, leaf.windowId),
  };
}

/** Moves the focused float into the tree as a `row` split beside the last pane (or alone). */
export function dockDesktopPane(desktop: Desktop): Desktop {
  const float =
    desktop.focusedPaneId === null ? null : findFloat(desktop.floats, desktop.focusedPaneId);
  if (float === null) {
    return desktop;
  }
  const floats = removeFloat(desktop.floats, float.paneId);
  const { tree } = desktop;
  if (tree === null) {
    return { ...desktop, floats, tree: singlePane(float.paneId, float.windowId) };
  }
  const docked = splitPane(tree, lastPane(tree).paneId, 'row', float.paneId, float.windowId);
  return { ...desktop, floats, tree: docked };
}

/** Removes a tree pane; focus moves to the sibling that took its place, else the topmost float. */
function removeTreePane(desktop: Desktop, tree: SplitTree, paneId: string): Desktop {
  const sibling = siblingOf(tree, paneId);
  const fallback = sibling === null ? topFloatId(desktop.floats) : firstPane(sibling).paneId;
  return {
    ...desktop,
    tree: closePane(tree, paneId),
    focusedPaneId: desktop.focusedPaneId === paneId ? fallback : desktop.focusedPaneId,
  };
}

/** Removes a float; focus moves to the next topmost float, else the first tree pane. */
function removeFloatPane(desktop: Desktop, paneId: string): Desktop {
  const floats = removeFloat(desktop.floats, paneId);
  const first = desktop.tree === null ? null : firstPane(desktop.tree).paneId;
  return {
    ...desktop,
    floats,
    focusedPaneId:
      desktop.focusedPaneId === paneId ? (topFloatId(floats) ?? first) : desktop.focusedPaneId,
  };
}

/** Removes the pane or float `paneId`, moving focus on when it had it; unchanged when unknown. */
export function removeDesktopPane(desktop: Desktop, paneId: string): Desktop {
  if (desktop.tree !== null && findPane(desktop.tree, paneId) !== null) {
    return removeTreePane(desktop, desktop.tree, paneId);
  }
  return findFloat(desktop.floats, paneId) === null ? desktop : removeFloatPane(desktop, paneId);
}

/** Adds a pane that came from another desktop, as a float when it has a rectangle, and focuses it. */
export function insertDesktopPane(desktop: Desktop, placed: PlacedPane): Desktop {
  if (placed.rect === null) {
    return splitDesktop(desktop, 'row', placed.paneId, placed.windowId);
  }
  const floats = addFloat(desktop.floats, placed.paneId, placed.windowId, placed.rect);
  return { ...desktop, floats, focusedPaneId: placed.paneId };
}
