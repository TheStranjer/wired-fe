/**
 * `/media [label] [n]` (decision 6 and 13, WFE-263, navigation `v` for "view"):
 * show one attachment of a post full size in a media window. The post resolves
 * the way the other post commands resolve theirs — a leading label names a post
 * of the active window's scrollback, otherwise the navigation selection stands,
 * and a boost shows its original — and `n` is the 1-based attachment, the first
 * when it is left out. A post with no attachments, or fewer than `n`, is refused
 * with how many it has. The window opens as a float unless `--in`, `openIn.media`
 * or `openIn` say otherwise (src/state/placement); opening the same post and
 * index twice activates the window that already shows it (src/state/mediaWindow).
 */

import { mediaOpen } from '../../state/mediaWindow';
import { placedRun } from '../openWindowRun';
import { OK, fail, syncRun } from '../outcome';
import { printedLabel, targetLabel } from '../statusLabel';
import { type StatusTarget, resolveStatusTarget } from '../targets';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's grammar: /help shows it, a bad index echoes it. */
const USAGE = '/media [label] [n]';

/** An attachment number: digits with no leading zero. */
const INDEX = /^[1-9]\d*$/u;

/** How many attachments, in words. */
function attachments(count: number): string {
  return count === 1 ? '1 attachment' : `${String(count)} attachments`;
}

/** The attachment number {@link text} asks for; the first when it says nothing. */
function wanted(text: string): number | null {
  if (text === '') {
    return 1;
  }
  return INDEX.test(text) ? Number(text) : null;
}

/** Open attachment {@link n} of {@link target}'s post. */
function openAttachment(context: CommandContext, target: StatusTarget, n: number): CommandOutcome {
  const { status } = target;
  const total = status.media_attachments.length;
  const named = targetLabel(context, status);
  if (total === 0) {
    return fail(`Post ${named} has no attachments`);
  }
  if (n > total) {
    return fail(`Post ${named} has ${attachments(total)}`);
  }
  const label = printedLabel(context, status);
  context.dispatchWindows(
    mediaOpen({
      statusId: status.id,
      accountKey: target.accountKey,
      n,
      total,
      label: label === status.id ? null : label,
    }),
  );
  return OK;
}

/** Resolve the post and the index, then ask the window list for the media window. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const target = resolveStatusTarget(args, context);
  if (!target.ok) {
    return fail(target.error);
  }
  const n = wanted(target.value.rest.trim());
  return n === null ? fail(`Usage: ${USAGE}`) : openAttachment(context, target.value, n);
}

/** The `/media` definition. */
export const command: CommandDefinition = {
  name: 'media',
  usage: USAGE,
  summary: "Show a post's attachment full size in a window",
  run: placedRun(syncRun(handle)),
  bindings: [{ mode: 'navigation', chord: 'v', args: '{label}' }],
};
