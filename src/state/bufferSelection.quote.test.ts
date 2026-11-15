/**
 * Tests for the quote half of the label lookup (WFE-99): a window labels a
 * shown quote beside its quoter, and the lookup answers with the quoted
 * status itself — under a plain post, under the original of a boost, and
 * inside a notification line alike.
 */
import { describe, expect, it } from 'vitest';

import { type Buffer, EMPTY_BUFFER, type NotificationLineData } from './buffer';
import { addStatuses } from './bufferPosts';
import { statusForLabel } from './bufferSelection';
import type { Status } from '../api/schemas/status';
import { notification, status } from '../test/fixtures';

/** A notification line keyed `nt:<id>`, as the notifications window holds them. */
function notificationLine(id: string, shown: Status | null): NotificationLineData {
  return { kind: 'notification', key: `nt:${id}`, notification: notification(id, shown) };
}

describe('statusForLabel with quotes', () => {
  it('finds the status a line quotes under the label its quote got', () => {
    const buffer = addStatuses(
      EMPTY_BUFFER,
      [status('outer', { quote: status('inner') })],
      'newer',
    );

    expect(statusForLabel(buffer, 'a0')?.id).toBe('outer');
    expect(statusForLabel(buffer, 'a1')?.id).toBe('inner');
  });

  it('finds the quote a boost shows, which rides on the original', () => {
    const buffer = addStatuses(
      EMPTY_BUFFER,
      [status('b', { reblog: status('orig', { quote: status('inner') }) })],
      'newer',
    );

    expect(statusForLabel(buffer, 'a1')?.id).toBe('inner');
  });

  it('finds the quote inside a notification line', () => {
    const mentioned = status('m2', { quote: status('inner') });
    const buffer: Buffer = {
      ...addStatuses(EMPTY_BUFFER, [mentioned], 'newer'),
      lines: [notificationLine('32', mentioned)],
    };

    expect(statusForLabel(buffer, 'a1')?.id).toBe('inner');
  });

  it('still answers null for a label whose quote left the scrollback', () => {
    const buffer = addStatuses(
      EMPTY_BUFFER,
      [status('outer', { quote: status('inner') })],
      'newer',
    );
    const cleared: Buffer = { ...buffer, lines: [] };

    expect(statusForLabel(cleared, 'a1')).toBeNull();
  });
});
