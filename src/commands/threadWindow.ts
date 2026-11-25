/**
 * Opening a post's thread window, shared by `/thread` and `/open` (decision 6):
 * the window list is asked for a `thread` window owned by the acting account
 * and targeted at the status id, titled `thread/<label or id>` after the line
 * the active window shows for the post.
 */

import { OK } from './outcome';
import { printedLabel } from './statusLabel';
import type { StatusTarget } from './targets';
import type { CommandContext, CommandOutcome } from './types';
import { threadWindowOpen } from '../state/threadWindow';

/** Open (or activate) the thread window of {@link target}'s post. */
export function openThreadWindow(context: CommandContext, target: StatusTarget): CommandOutcome {
  const { status, accountKey } = target;
  context.dispatchWindows(threadWindowOpen(status.id, accountKey, printedLabel(context, status)));
  return OK;
}
