/**
 * What `/pop` answers before it opens anything (decisions 6, 12 and 13,
 * WFE-291): a thread is never popped out of itself, and a thread already on
 * screen is brought forward instead of shown a second time. Both checks run
 * on the active desktop; when neither applies, `/pop` goes on to float the
 * thread as `/float thread <label>` does.
 */

import { OK, fail } from './outcome';
import { viewToShow } from './splitRun';
import { resolveStatusTarget } from './targets';
import type { CommandContext, CommandOutcome } from './types';
import { shownPanes } from '../windows/desktopPanes';
import { activeDesktop } from '../windows/desktops';
import { activeWindow } from '../windows/model';

/** The info line printed when the post named is already in the thread being read. */
const IN_THREAD = 'Already in this thread';

/** The usage a view spec that does not parse echoes; the spec here is always well formed. */
const USAGE = '/pop [label]';

/**
 * Whether the thread of {@link args}' post is already the one being read or
 * already shown, and what `/pop` then says: from inside a thread window the
 * post is in its own scrollback, so nothing opens and an info line says so
 * (a label the window never gave is refused as `/thread` refuses it); with the
 * thread window shown in a pane or float of the active desktop, that pane takes
 * focus (a float is raised by it) and nothing new opens. Null when `/pop` should
 * open the thread.
 */
export async function popInPlace(
  args: string,
  context: CommandContext,
): Promise<CommandOutcome | null> {
  if (activeWindow(context.state.windows).ref.kind === 'thread') {
    const target = resolveStatusTarget(args, context);
    if (!target.ok) {
      return fail(target.error);
    }
    context.print(IN_THREAD);
    return OK;
  }
  const shown = await viewToShow(`thread ${args.trim()}`, context, USAGE);
  if (!shown.ok) {
    return fail(shown.error);
  }
  // A thread window not yet open is shown by nothing: its `windowId` is then only the pane to split.
  const showing =
    shown.value.open === null
      ? shownPanes(activeDesktop(context.state.layout)).find(
          (pane) => pane.windowId === shown.value.windowId,
        )
      : undefined;
  if (showing === undefined) {
    return null;
  }
  context.dispatch({ type: 'layout', action: { type: 'focusPane', paneId: showing.paneId } });
  return OK;
}
