/**
 * Selection, content-warning reveal and label lookup for one window's buffer
 * (AGENTS.md "Windows, like IRC buffers", "Every post has a short label"). The
 * navigation mode moves the selection between the lines that carry a post; the
 * reveal set holds which content warnings stand open; the label book answers
 * what a command's `[a3]` refers to. Like the rest of src/state every
 * transition is pure and returns the very same buffer when its request changes
 * nothing, so callers can compare by identity.
 */

import type { Buffer, LineData } from './buffer';
import { shownQuote } from './bufferPosts';
import type { Status } from '../api/schemas/status';
import { idForLabel, labelForId } from '../windows/labels';

/**
 * The status a line refers to: a post line shows its own status, a notification
 * line the status that came with it — null for a follow request or a client
 * message, because there is nothing to show and nothing to select.
 */
export function statusOfLine(line: LineData): Status | null {
  return lineStatusOf(line)?.status ?? null;
}

/** A status as one line shows it, with the account that line was fetched by (decision 14). */
export type LineStatus = {
  readonly status: Status;
  /** The account that fetched the line; null when unknown, so the window's account stands. */
  readonly accountKey: string | null;
};

/** {@link statusOfLine} with the account that fetched the line; null where there is no status. */
function lineStatusOf(line: LineData): LineStatus | null {
  switch (line.kind) {
    case 'post':
      return { status: line.status, accountKey: line.accountKey };
    case 'notification':
      return line.notification.status === null
        ? null
        : { status: line.notification.status, accountKey: line.accountKey };
    case 'system':
      return null;
  }
}

/**
 * The keys navigation can select, top to bottom: every line carrying a status,
 * the client messages and status-less notifications skipped.
 */
export function selectableKeys(buffer: Buffer): readonly string[] {
  return buffer.lines.filter((line) => statusOfLine(line) !== null).map((line) => line.key);
}

/**
 * Move the selection within `keys` to `index`. A missing index — an unknown key,
 * a move past either end — and a line already selected both leave this very
 * buffer behind; {@link selectRelative} holds its moves inside the ends.
 */
function selectAtIndex(buffer: Buffer, keys: readonly string[], index: number): Buffer {
  const key = keys[index];
  if (key === undefined || key === buffer.selectedKey) {
    return buffer;
  }
  return { ...buffer, selectedKey: key };
}

/** `index` after `delta` steps, held inside `last`. */
function moveWithin(index: number, delta: number, last: number): number {
  return Math.min(Math.max(index + delta, 0), last);
}

/**
 * Put the selection on the line `key`, or clear it for `null`. A key that is not
 * a selectable line — a client message, a line that has scrolled out, anything
 * unknown — leaves this very buffer behind, as does a key already selected.
 */
export function selectKey(buffer: Buffer, key: string | null): Buffer {
  if (key === null) {
    return buffer.selectedKey === null ? buffer : { ...buffer, selectedKey: null };
  }
  const keys = selectableKeys(buffer);
  return selectAtIndex(buffer, keys, keys.indexOf(key));
}

/**
 * Move the selection by `delta` selectable lines, positive towards the newest at
 * the bottom, and hold it at both ends. While nothing is selected the newest
 * line takes the selection instead, and so it does when the selected line has
 * since left the scrollback; the same holds for a buffer with nothing to select,
 * which comes back as it was.
 */
export function selectRelative(buffer: Buffer, delta: number): Buffer {
  const keys = selectableKeys(buffer);
  if (keys.length === 0) {
    return buffer;
  }
  const last = keys.length - 1;
  const index = buffer.selectedKey === null ? -1 : keys.indexOf(buffer.selectedKey);
  if (index === -1) {
    return selectAtIndex(buffer, keys, last);
  }
  return selectAtIndex(buffer, keys, moveWithin(index, delta, last));
}

/** Put the selection on the oldest selectable line (`first`) or the newest one (`last`). */
export function selectEdge(buffer: Buffer, edge: 'first' | 'last'): Buffer {
  const keys = selectableKeys(buffer);
  if (keys.length === 0) {
    return buffer;
  }
  return selectAtIndex(buffer, keys, edge === 'first' ? 0 : keys.length - 1);
}

/**
 * Open or close the content warning of the line `key`: the key joins
 * {@link Buffer.revealed} when it was not in it and leaves when it was. The set
 * is copied, so the buffer handed over keeps its own.
 */
export function toggleRevealed(buffer: Buffer, key: string): Buffer {
  const revealed = new Set(buffer.revealed);
  if (revealed.has(key)) {
    revealed.delete(key);
  } else {
    revealed.add(key);
  }
  return { ...buffer, revealed };
}

/**
 * The status the selection stands on: the post of a post line, the one a
 * notification carried, null while nothing is selected or the selected line
 * carries none — including when it has scrolled out from under the selection.
 */
export function selectedStatus(buffer: Buffer): Status | null {
  return selectedLineStatus(buffer)?.status ?? null;
}

/** {@link selectedStatus} with the account that fetched the selected line. */
export function selectedLineStatus(buffer: Buffer): LineStatus | null {
  const line = buffer.lines.find((entry) => entry.key === buffer.selectedKey);
  return line === undefined ? null : lineStatusOf(line);
}

/**
 * The status a command's label stands for: {@link idForLabel} reads the label in
 * any case, the line showing that id answers — as its own status, or as the
 * quote shown on it, which the label book grew for too. null for a label this
 * window never gave, and for one whose line has scrolled out of the scrollback
 * while the label stayed in the book.
 */
export function statusForLabel(buffer: Buffer, label: string): Status | null {
  return lineStatusForLabel(buffer, label)?.status ?? null;
}

/** {@link statusForLabel} with the account that fetched the line the label stands on. */
export function lineStatusForLabel(buffer: Buffer, label: string): LineStatus | null {
  const id = idForLabel(buffer.labels, label);
  if (id === undefined) {
    return null;
  }
  for (const line of buffer.lines) {
    const found = lineStatusOf(line);
    if (found === null) {
      continue;
    }
    const shown = withId(found.status, id);
    if (shown !== null) {
      return { status: shown, accountKey: found.accountKey };
    }
  }
  return null;
}

/** The status `id` as {@link status} shows it: itself, or the quote shown on it; else null. */
function withId(status: Status, id: string): Status | null {
  if (status.id === id) {
    return status;
  }
  const quoted = shownQuote(status);
  return quoted !== null && quoted.id === id ? quoted : null;
}

/**
 * The label this window gave the status `statusId`, in whichever case the post
 * arrived under, and null for a status it has never shown. The book outlives the
 * scrollback, so a labelled post that has scrolled away keeps answering.
 */
export function labelForStatus(buffer: Buffer, statusId: string): string | null {
  return labelForId(buffer.labels, statusId) ?? null;
}
