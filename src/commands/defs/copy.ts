/**
 * `/copy` (decision 6, alias `/yank`): put a post's link on the clipboard. The
 * target resolves the way the other post commands resolve theirs: a leading
 * label names a post of the active window's scrollback, otherwise the
 * navigation selection stands, and a boost copies its original (decision 6).
 * The link is the post's `url ?? uri`, exactly what `/open` would follow. A
 * browser that refuses the write — no permission, no clipboard, an insecure
 * context — is answered with a plain refusal, never a false `copied`.
 */

import type { Status } from '../../api/schemas/status';
import { resolveStatusTarget } from '../targets';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The link is on the clipboard and was printed. */
const OK: CommandOutcome = { ok: true };

/** Shown when the browser rejects the write or has no clipboard at all. */
const UNAVAILABLE: CommandOutcome = {
  ok: false,
  message: 'Clipboard unavailable',
};

/** Where a post links: its web page, or its canonical id when it has none. */
function linkOf(status: Status): string {
  return status.url ?? status.uri;
}

/** Resolve the target, write its link, and print what was copied. */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const target = resolveStatusTarget(args, context);
  if (!target.ok) {
    return { ok: false, message: target.error };
  }
  const link = linkOf(target.value.status);
  try {
    await navigator.clipboard.writeText(link);
  } catch {
    return UNAVAILABLE;
  }
  context.print(`copied ${link}`);
  return OK;
}

/** The `/copy` (alias `/yank`) definition. */
export const command: CommandDefinition = {
  name: 'copy',
  aliases: ['yank'],
  usage: '/copy [label]',
  summary: 'Copy a post link to the clipboard',
  run: handle,
  bindings: [{ mode: 'navigation', chord: 'y', args: '' }],
};
