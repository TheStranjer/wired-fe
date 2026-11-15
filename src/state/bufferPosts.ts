/**
 * The post lines of a window's buffer: the transitions that put statuses on
 * the scrollback, update them and take them away (AGENTS.md "Windows, like IRC
 * buffers"). APIs return statuses newest first while the buffer keeps its lines
 * oldest first, so {@link addStatuses} turns each batch around; every status id
 * that joins gets its window label in the order it is added, and the shown
 * quote of a line is labelled right after its quoter so commands can name it
 * too. Like the rest of src/state these functions are pure, and each returns
 * the very same buffer when its request matches nothing, so callers can compare
 * by identity.
 */

import { type Buffer, capLines, type LineData, type PostLineData } from './buffer';
import type { Status } from '../api/schemas/status';
import { assignLabel, type LabelBook } from '../windows/labels';

/** Which end of the scrollback a fetched page of statuses joins. */
export type Where = 'newer' | 'older';

/** The key of the post line carrying status `id`, stable for the buffer's life. */
function postKey(id: string): string {
  return `post:${id}`;
}

/** Whether this line shows status `id`: directly, or as the post it boosts. */
function showsStatus(line: LineData, id: string): boolean {
  return line.kind === 'post' && (line.status.id === id || line.status.reblog?.id === id);
}

/**
 * The statuses that have no post line yet, in API order: ids the buffer
 * already carries under `post:<id>` and repeats inside the batch are skipped.
 */
function freshStatuses(lines: readonly LineData[], statuses: readonly Status[]): Status[] {
  const taken = new Set<string>();
  for (const line of lines) {
    if (line.kind === 'post') {
      taken.add(line.key);
    }
  }
  const fresh: Status[] = [];
  for (const status of statuses) {
    const key = postKey(status.id);
    if (!taken.has(key)) {
      taken.add(key);
      fresh.push(status);
    }
  }
  return fresh;
}

/** The quote a post line shows: a boost quotes through its original, a plain
 * status with its own. Exported for the label lookup, which must answer for
 * exactly the quotes the book was grown with. */
export function shownQuote(status: Status): Status | null {
  return (status.reblog ?? status).quote;
}

/**
 * The post lines for `chronological` (oldest first) and the label book grown
 * by each status id — and by its shown quote's, right after — in the order
 * their lines join the buffer.
 */
function labelLines(
  labels: LabelBook,
  chronological: readonly Status[],
): readonly [PostLineData[], LabelBook] {
  const lines: PostLineData[] = [];
  let book = labels;
  for (const status of chronological) {
    [book] = assignLabel(book, status.id);
    const quoted = shownQuote(status);
    if (quoted !== null) {
      [book] = assignLabel(book, quoted.id);
    }
    lines.push({ kind: 'post', key: postKey(status.id), status });
  }
  return [lines, book];
}

/**
 * Put a page of statuses on the scrollback. `statuses` is in API order, newest
 * first: the ones already shown or repeated in the batch are skipped, the rest
 * are reversed into chronological order, labelled in the order they are added,
 * and appended under the existing lines (`newer`) or prepended above them
 * (`older`); the result is capped. The same buffer comes back when nothing new
 * arrived.
 */
export function addStatuses(buffer: Buffer, statuses: readonly Status[], where: Where): Buffer {
  const chronological = freshStatuses(buffer.lines, statuses).toReversed();
  if (chronological.length === 0) {
    return buffer;
  }
  const [lines, labels] = labelLines(buffer.labels, chronological);
  const merged = where === 'newer' ? [...buffer.lines, ...lines] : [...lines, ...buffer.lines];
  return { ...buffer, labels, lines: capLines(merged) };
}

/**
 * Report a changed status to the scrollback: every line showing it directly
 * gets the new status, every line boosting it keeps boosting it, now the new
 * one. Lines of other kinds pass through untouched, and the same buffer comes
 * back when no line shows this id.
 */
export function replaceStatus(buffer: Buffer, status: Status): Buffer {
  const shown = buffer.lines.some((line) => showsStatus(line, status.id));
  if (!shown) {
    return buffer;
  }
  const lines = buffer.lines.map((line): LineData => {
    if (line.kind === 'post' && line.status.id === status.id) {
      return { ...line, status };
    }
    if (line.kind === 'post' && line.status.reblog?.id === status.id) {
      return { ...line, status: { ...line.status, reblog: status } };
    }
    return line;
  });
  return { ...buffer, lines };
}

/**
 * Report a deleted status to the scrollback: the lines showing it, directly or
 * through a boost, come off, and the selection clears when it stood on one of
 * them. The same buffer comes back when no line shows this id.
 */
export function removeStatus(buffer: Buffer, id: string): Buffer {
  const lines = buffer.lines.filter((line) => !showsStatus(line, id));
  if (lines.length === buffer.lines.length) {
    return buffer;
  }
  const selected = buffer.selectedKey;
  const selectedShown =
    selected !== null &&
    buffer.lines.some((line) => line.key === selected && showsStatus(line, id));
  return { ...buffer, lines, selectedKey: selectedShown ? null : selected };
}
