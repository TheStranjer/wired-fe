/**
 * The notification lines of a window's buffer: the transitions that put a page
 * of notifications on the scrollback and take one off (AGENTS.md "Windows, like
 * IRC buffers"). APIs return notifications newest first while the buffer keeps
 * its lines oldest first, so {@link addNotifications} turns each batch around
 * exactly as bufferPosts does its statuses; a notification that carries a
 * status gives that status the window's label, in the order its line joins.
 * The label book outlives the line: removing a notification takes its line off
 * but retires no label. Like the rest of src/state these functions are pure,
 * and each returns the very same buffer when its request matches nothing, so
 * callers can compare by identity.
 */

import { type Buffer, capLines, type LineData, type NotificationLineData } from './buffer';
import type { Where } from './bufferPosts';
import type { Notification } from '../api/schemas/notification';
import { assignLabel, type LabelBook } from '../windows/labels';

/** The key of the line carrying notification `id`, stable for the buffer's life. */
function notifKey(id: string): string {
  return `notif:${id}`;
}

/**
 * The notifications that have no line yet, in API order: ids the buffer
 * already carries under `notif:<id>` and repeats inside the batch are skipped.
 */
function freshNotifications(
  lines: readonly LineData[],
  notifications: readonly Notification[],
): Notification[] {
  const taken = new Set<string>();
  for (const line of lines) {
    if (line.kind === 'notification') {
      taken.add(line.key);
    }
  }
  const fresh: Notification[] = [];
  for (const notification of notifications) {
    const key = notifKey(notification.id);
    if (!taken.has(key)) {
      taken.add(key);
      fresh.push(notification);
    }
  }
  return fresh;
}

/**
 * The notification lines for `chronological` (oldest first) and the label book
 * grown by the status id of each line that joins and carries one.
 */
function labelLines(
  labels: LabelBook,
  chronological: readonly Notification[],
): readonly [NotificationLineData[], LabelBook] {
  const lines: NotificationLineData[] = [];
  let book = labels;
  for (const notification of chronological) {
    const { status } = notification;
    if (status !== null) {
      [book] = assignLabel(book, status.id);
    }
    lines.push({ kind: 'notification', key: notifKey(notification.id), notification });
  }
  return [lines, book];
}

/**
 * Put a page of notifications on the scrollback. `notifications` is in API
 * order, newest first: the ones already shown or repeated in the batch are
 * skipped, the rest are reversed into chronological order, each status they
 * carry labelled in the order its line joins, and appended under the existing
 * lines (`newer`) or prepended above them (`older`); the result is capped. The
 * same buffer comes back when nothing new arrived.
 */
export function addNotifications(
  buffer: Buffer,
  notifications: readonly Notification[],
  where: Where,
): Buffer {
  const chronological = freshNotifications(buffer.lines, notifications).toReversed();
  if (chronological.length === 0) {
    return buffer;
  }
  const [lines, labels] = labelLines(buffer.labels, chronological);
  const merged = where === 'newer' ? [...buffer.lines, ...lines] : [...lines, ...buffer.lines];
  return { ...buffer, labels, lines: capLines(merged) };
}

/**
 * Take one notification off the scrollback: the line keyed `notif:<id>` comes
 * off and the selection clears when it stood on that line; the labels its
 * status carries stay in the book, as every label does. The same buffer comes
 * back when no line carries this id.
 */
export function removeNotification(buffer: Buffer, id: string): Buffer {
  const key = notifKey(id);
  const lines = buffer.lines.filter((line) => line.key !== key);
  if (lines.length === buffer.lines.length) {
    return buffer;
  }
  return { ...buffer, lines, selectedKey: buffer.selectedKey === key ? null : buffer.selectedKey };
}
