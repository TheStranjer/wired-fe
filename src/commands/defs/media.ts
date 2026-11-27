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

import { t } from '../../i18n/translate';
import { mediaOpen } from '../../state/mediaWindow';
import { placedRun } from '../openWindowRun';
import { OK, fail, syncRun } from '../outcome';
import { printedLabel, targetLabel } from '../statusLabel';
import { type StatusTarget, resolveStatusTarget } from '../targets';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** An attachment number: digits with no leading zero. */
const INDEX = /^[1-9]\d*$/u;

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
    return fail(t('commands.defs.media.no_attachments', { label: named }));
  }
  if (n > total) {
    return fail(t('commands.defs.media.few_attachments', { label: named, count: total }));
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
  const target = resolveStatusTarget(args, context, 'read');
  if (!target.ok) {
    return fail(target.error);
  }
  const n = wanted(target.value.rest.trim());
  return n === null
    ? fail(t('commands.defs.media.usage_error'))
    : openAttachment(context, target.value, n);
}

/** The `/media` definition. */
export const command: CommandDefinition = {
  name: 'media',
  get usage(): string {
    return t('commands.defs.media.usage');
  },
  get summary(): string {
    return t('commands.defs.media.summary');
  },
  run: placedRun(syncRun(handle)),
  bindings: [{ mode: 'navigation', chord: 'v', args: '{label}' }],
};
