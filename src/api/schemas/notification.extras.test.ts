/**
 * Tests for what the Notification schema keeps of a report (Mastodon's
 * `comment`/`target_account`, Pleroma's `content`/`account`) and of a Pleroma
 * chat message's text.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { type Notification, NotificationSchema } from './notification';
import { status, TEST_DATE } from '../../test/fixtures';

/** The actor of every notification here. */
const ACCOUNT = status('actor').account;

/** Parses a wire notification of `type` carrying `extras`. */
function parse(type: string, extras: Record<string, unknown>): Notification {
  return v.parse(NotificationSchema, {
    id: 'n1',
    type,
    created_at: TEST_DATE,
    account: ACCOUNT,
    ...extras,
  });
}

describe('Notification schema extras', () => {
  it('keeps a Mastodon report: its comment and the reported account', () => {
    const output = parse('admin.report', {
      report: { id: 'r1', comment: 'spam', target_account: { ...ACCOUNT, id: '2', acct: 'eve' } },
    });

    expect(output.kind).toBe('report');
    expect(output.report?.comment).toBe('spam');
    expect(output.report?.target?.acct).toBe('eve');
  });

  it('keeps a Pleroma report: its content and the reported account', () => {
    const output = parse('pleroma:report', {
      report: { id: 'r2', content: 'rude', account: { ...ACCOUNT, id: '3', acct: 'mallory' } },
    });

    expect(output.report?.comment).toBe('rude');
    expect(output.report?.target?.acct).toBe('mallory');
  });

  it('reads a report with no comment and no target as empty', () => {
    const output = parse('admin.report', { report: { id: 'r3', comment: null } });

    expect(output.report).toStrictEqual({ comment: '', target: null });
  });

  it('keeps the text of a chat message, empty when it has none', () => {
    const text = parse('pleroma:chat_mention', { chat_message: { id: 'c1', content: 'hello' } });
    const none = parse('pleroma:chat_mention', { chat_message: { id: 'c2', content: null } });

    expect(text.chat_message).toStrictEqual({ content: 'hello' });
    expect(none.chat_message).toStrictEqual({ content: '' });
  });
});
