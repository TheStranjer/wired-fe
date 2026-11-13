/**
 * Tests for what a line shows and what the buffer answers about it: the status
 * behind a line and under the selection, opening and closing a content warning,
 * and the label lookup both ways round — case-insensitive, and across the cap
 * that drops a line while the label it was given stays in the book.
 */
import { describe, expect, it } from 'vitest';

import {
  appendSystem,
  type Buffer,
  EMPTY_BUFFER,
  type NotificationLineData,
  type PostLineData,
  SCROLLBACK_LIMIT,
  type SystemLineData,
} from './buffer';
import { addStatuses } from './bufferPosts';
import {
  labelForStatus,
  selectKey,
  selectedStatus,
  statusForLabel,
  statusOfLine,
  toggleRevealed,
} from './bufferSelection';
import type { Status } from '../api/schemas/status';
import { notification, status, TEST_DATE } from '../test/fixtures';

/** The date every client message carries. */
const DATE = new Date(TEST_DATE);

/** A post the author hid behind a content warning. */
function warning(id: string): Status {
  return status(id, { spoiler_text: 'down here', sensitive: true });
}

/** A post line keyed `post:<id>`, as addStatuses builds them. */
function postLine(shown: Status): PostLineData {
  return { kind: 'post', key: `post:${shown.id}`, status: shown };
}

/** A notification line keyed `nt:<id>`, as the notifications window holds them. */
function notificationLine(id: string, shown: Status | null): NotificationLineData {
  return { kind: 'notification', key: `nt:${id}`, notification: notification(id, shown) };
}

/** A client message keyed `sys:<seq>`. */
function systemLine(seq: number): SystemLineData {
  return { kind: 'system', key: `sys:${String(seq)}`, date: DATE, level: 'info', text: 'l' };
}

/** Posts a, b and c under a client message, labelled a0, a1 and a2 in that order. */
function labelled(): Buffer {
  const first = appendSystem(EMPTY_BUFFER, { date: DATE, level: 'info', text: 'l' }, 0);
  return addStatuses(first, [status('c'), status('b'), status('a')], 'newer');
}

/** A buffer filled to the cap with client messages, one labelled post pushed off. */
function scrolledOut(old: string): Buffer {
  let buffer = addStatuses(EMPTY_BUFFER, [status(old)], 'newer');
  for (let seq = 0; seq < SCROLLBACK_LIMIT; seq += 1) {
    buffer = appendSystem(buffer, { date: DATE, level: 'info', text: 'l' }, seq);
  }
  return buffer;
}

describe(statusOfLine, () => {
  it('answers with the status a post line shows', () => {
    const shown = status('p');

    expect(statusOfLine(postLine(shown))).toBe(shown);
  });

  it('answers with the status a notification carried', () => {
    const line = notificationLine('31', status('m'));

    expect(statusOfLine(line)).toBe(line.notification.status);
    expect(statusOfLine(line)?.id).toBe('m');
  });

  it('answers null for a follow request and for a client message', () => {
    expect(statusOfLine(notificationLine('32', null))).toBeNull();
    expect(statusOfLine(systemLine(0))).toBeNull();
  });
});

describe(selectedStatus, () => {
  it('answers null while nothing is selected', () => {
    expect(selectedStatus(labelled())).toBeNull();
    expect(selectedStatus(EMPTY_BUFFER)).toBeNull();
  });

  it('answers with the status of the selected post', () => {
    const shown = status('b');

    expect(selectedStatus(selectKey(addStatuses(EMPTY_BUFFER, [shown], 'newer'), 'post:b'))).toBe(
      shown,
    );
  });

  it('answers with the status of the selected notification', () => {
    const buffer: Buffer = { ...labelled(), lines: [notificationLine('31', status('m'))] };

    expect(selectedStatus(selectKey(buffer, 'nt:31'))?.id).toBe('m');
  });

  it('answers null when the selection stands on a client message', () => {
    expect(selectedStatus({ ...labelled(), selectedKey: 'sys:0' })).toBeNull();
  });

  it('answers null when the selected line has scrolled out', () => {
    expect(selectedStatus({ ...labelled(), selectedKey: 'post:gone' })).toBeNull();
  });
});

describe(toggleRevealed, () => {
  it('opens the content warning of a line', () => {
    const before = labelled();
    const after = toggleRevealed(before, 'post:b');

    expect(after.revealed).toContain('post:b');
    expect(after.revealed).not.toBe(before.revealed);
    expect(before.revealed).not.toContain('post:b');
    expect(after.lines).toBe(before.lines);
    expect(after.labels).toBe(before.labels);
  });

  it('closes the content warning again', () => {
    const opened = toggleRevealed(labelled(), 'post:b');

    expect(opened.revealed.size).toBe(1);
    expect(toggleRevealed(opened, 'post:b').revealed.size).toBe(0);
  });

  it('leaves the other open warnings standing', () => {
    const twice = toggleRevealed(toggleRevealed(labelled(), 'post:a'), 'post:c');

    expect([...twice.revealed]).toStrictEqual(['post:a', 'post:c']);
    expect([...toggleRevealed(twice, 'post:a').revealed]).toStrictEqual(['post:c']);
  });

  it('keeps each warning on the line it belongs to', () => {
    const hidden = warning('cw');
    const buffer = toggleRevealed(addStatuses(labelled(), [hidden], 'newer'), 'post:cw');
    const last = buffer.lines.at(-1);

    expect(last?.kind === 'post' && last.status.spoiler_text).toBe('down here');
    expect(buffer.revealed).toStrictEqual(new Set(['post:cw']));
  });

  it('flips a key the scrollback no longer holds', () => {
    const buffer = scrolledOut('old');
    const opened = toggleRevealed(buffer, 'post:old');

    expect(opened.revealed).toContain('post:old');
    expect(toggleRevealed(opened, 'post:old').revealed).not.toContain('post:old');
    expect(buffer.revealed.size).toBe(0);
  });
});

describe(statusForLabel, () => {
  it('finds the status the window labelled', () => {
    const buffer = labelled();

    expect(statusForLabel(buffer, 'a0')?.id).toBe('a');
    expect(statusForLabel(buffer, 'a1')?.id).toBe('b');
    expect(statusForLabel(buffer, 'a2')?.id).toBe('c');
  });

  it('answers with the very status on the line', () => {
    const shown = status('only');

    expect(statusForLabel(addStatuses(EMPTY_BUFFER, [shown], 'newer'), 'a0')).toBe(shown);
  });

  it('reads the label in any case', () => {
    const buffer = labelled();

    expect(statusForLabel(buffer, 'A1')?.id).toBe('b');
    expect(statusForLabel(buffer, 'a1')?.id).toBe('b');
  });

  it('answers null for a label this window never gave', () => {
    const buffer = labelled();

    expect(statusForLabel(buffer, 'a3')).toBeNull();
    expect(statusForLabel(buffer, 'zz9')).toBeNull();
    expect(statusForLabel(EMPTY_BUFFER, 'a0')).toBeNull();
  });

  it('answers null once the line has scrolled out from under the label', () => {
    const buffer = scrolledOut('old');

    expect(buffer.lines).toHaveLength(SCROLLBACK_LIMIT);
    expect(statusForLabel(buffer, 'a0')).toBeNull();
  });

  it('finds the notification carrying the labelled status', () => {
    const mentioned = status('m1');
    const buffer: Buffer = {
      ...addStatuses(EMPTY_BUFFER, [mentioned], 'newer'),
      lines: [notificationLine('31', mentioned)],
    };

    expect(statusForLabel(buffer, 'a0')?.id).toBe('m1');
  });
});

describe(labelForStatus, () => {
  it('answers with the label the window gave the post', () => {
    const buffer = labelled();

    expect(labelForStatus(buffer, 'a')).toBe('a0');
    expect(labelForStatus(buffer, 'c')).toBe('a2');
  });

  it('answers null for a status it has never shown', () => {
    expect(labelForStatus(labelled(), 'never')).toBeNull();
    expect(labelForStatus(EMPTY_BUFFER, 'a')).toBeNull();
  });

  it('keeps the label after the line has scrolled out', () => {
    const buffer = scrolledOut('old');

    expect(labelForStatus(buffer, 'old')).toBe('a0');
    expect(statusForLabel(buffer, 'a0')).toBeNull();
  });
});
