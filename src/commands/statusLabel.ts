/**
 * The label a post command names its post by (decision 6, AGENTS.md "Every post
 * has a short label"): the active window's own label for the line that shows the
 * status. The target resolvers hand a boost back as its original, so looking the
 * label up by the original's id would name the wrong line — the book is searched
 * for the line that carries the status, directly or as its boost, which is why
 * the `[a3]` a command prints and the `a3` it fills into `/edit a3 …` are the
 * very label the reader sees. A status no line of this window shows — one that
 * never came through it, or one that has scrolled out while its label stayed in
 * the book — answers with its bare id. The bracketed {@link targetLabel} is the
 * same lookup as the commands print it.
 */

import type { CommandContext } from './types';
import type { Status } from '../api/schemas/status';
import { labelForStatus, statusOfLine } from '../state/bufferSelection';
import { activeBuffer } from '../state/selectors';

/** The active window's label for the line showing {@link status} or its boost. */
export function printedLabel(context: CommandContext, status: Status): string {
  const buffer = activeBuffer(context.state);
  for (const line of buffer.lines) {
    const shown = statusOfLine(line);
    if (shown !== null && (shown === status || shown.reblog === status)) {
      return labelForStatus(buffer, shown.id) ?? status.id;
    }
  }
  return status.id;
}

/**
 * The bracketed label of the active window's line that shows {@link status},
 * directly or as the original it boosts: the `[a3]` the post commands print, so
 * what they name is the line the user is looking at. The bare id for a status no
 * line carries, or for a window that never labelled it.
 */
export function targetLabel(context: CommandContext, status: Status): string {
  return `[${printedLabel(context, status)}]`;
}
