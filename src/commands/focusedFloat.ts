/**
 * The float that has focus on the active desktop (decision 12), which
 * `/dock`, `/raise` and `/float move|size` act on. Reading only: the layout
 * reducer does the change.
 */

import type { CommandContext } from './types';
import { activeDesktop } from '../windows/desktops';
import { findFloat } from '../windows/floats';
import type { FloatPane } from '../windows/floats';

/** The focused float of the active desktop, or null when a tree pane or nothing has focus. */
export function focusedFloat(context: CommandContext): FloatPane | null {
  const { floats, focusedPaneId } = activeDesktop(context.state.layout);
  return focusedPaneId === null ? null : findFloat(floats, focusedPaneId);
}
