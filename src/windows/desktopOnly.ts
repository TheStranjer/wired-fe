/**
 * The `only` transition on a single desktop (ARCHITECTURE.md decision 12):
 * every pane and float but the focused one closes. Pure: the desktop comes
 * back unchanged when nothing has focus or nothing else is there.
 */
import type { Desktop } from './desktopPanes';
import { findFloat } from './floats';
import { findPane } from './splitTree';

/** The desktop reduced to its focused pane or float; the windows they showed stay open. */
export function onlyDesktopPane(desktop: Desktop): Desktop {
  const { tree, floats, focusedPaneId } = desktop;
  if (focusedPaneId === null) {
    return desktop;
  }
  const leaf = tree === null ? null : findPane(tree, focusedPaneId);
  if (leaf !== null) {
    return tree === leaf && floats.length === 0 ? desktop : { ...desktop, tree: leaf, floats: [] };
  }
  const float = findFloat(floats, focusedPaneId);
  if (float === null || (tree === null && floats.length === 1)) {
    return desktop;
  }
  return { ...desktop, tree: null, floats: [float] };
}
