/**
 * Who is in a window (WFE-133): the distinct authors a buffer's content lines
 * show, most recent first, for the side pane's nick list. A post line names
 * the author of the status it shows — for a boost, the author of the original
 * its row speaks for; a notification line names its actor; a client message
 * names nobody. Identities fold by account id, the very key profile windows
 * are found by (src/windows/model), so ten lines by one author fill one slot.
 */

import type { Account } from '../api/schemas/account';
import type { Buffer, LineData } from '../state/buffer';

/** The account a line's author nick stands for; null when it shows none. */
function lineAuthor(line: LineData): Account | null {
  switch (line.kind) {
    case 'system':
      return null;
    case 'post':
      return (line.status.reblog ?? line.status).account;
    case 'notification':
      return line.notification.account;
  }
}

/**
 * The distinct authors of {@link buffer}'s lines, most recent first, at most
 * {@link limit} of them. The buffer keeps its lines oldest first, so the walk
 * starts at its end; a limit of zero or less lists nobody.
 */
export function participants(buffer: Buffer, limit: number): readonly Account[] {
  if (limit <= 0) {
    return [];
  }
  const authors: Account[] = [];
  const seen = new Set<string>();
  for (const line of buffer.lines.toReversed()) {
    const author = lineAuthor(line);
    if (author === null || seen.has(author.id)) {
      continue;
    }
    seen.add(author.id);
    authors.push(author);
    if (authors.length >= limit) {
      return authors;
    }
  }
  return authors;
}
