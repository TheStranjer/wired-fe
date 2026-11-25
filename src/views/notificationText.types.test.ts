/**
 * Fixture-based tests for ./notificationText over the notification types
 * WFE-176 added: Mastodon's `quote`, `quoted_update`, `update`, `admin.*`,
 * `severed_relationships`, `moderation_warning` and `annual_report`, Pleroma's
 * `pleroma:report` and `pleroma:chat_mention`, the own-poll versus voted-poll
 * wording, mentions of posts with no words, and the unknown-type fallback.
 * Each wire shape is parsed through the real schema first.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { notificationText } from './notificationText';
import type { Viewer } from './postView';
import { type Notification, NotificationSchema } from '../api/schemas/notification';
import { status, TEST_DATE } from '../test/fixtures';

/** The viewer: account `1` (the author of every fixture status) on the instance. */
const VIEWER: Viewer = { origin: 'https://wired.example', accountId: '1' };

/** A viewer whose own id is not the author's. */
const OTHER: Viewer = { origin: 'https://wired.example', accountId: '99' };

/** The actor every notification names. */
const ACTOR = status('actor').account;

/** One wire notification of `type`, with `extras` such as `report` or `status`. */
function note(type: string, extras: Record<string, unknown> = {}): Notification {
  return v.parse(NotificationSchema, {
    id: 'n1',
    type,
    created_at: TEST_DATE,
    account: ACTOR,
    ...extras,
  });
}

/** The sentence of {@link n} for the viewer {@link VIEWER}, its status labelled `a3`. */
function say(n: Notification, viewer: Viewer = VIEWER): string {
  return notificationText(n, n.status === null ? null : 'a3', viewer);
}

/** A reported account, as Mastodon's `target_account` and Pleroma's `account` carry it. */
const TARGET = { ...ACTOR, id: '7', acct: 'eve@bad.example' };

describe('quotes and edits', () => {
  it('says who quoted which post, with the words of the quoting post', () => {
    const quoting = status('q', { content: '<p>look at this</p>' });

    expect(say(note('quote', { status: quoting }))).toBe(
      '@lain@wired.example quoted [a3] "look at this"',
    );
  });

  it('says a quoting post with no words has no text', () => {
    expect(say(note('quote', { status: status('q', { content: '' }) }))).toBe(
      '@lain@wired.example quoted [a3] (no text)',
    );
  });

  it('summarizes the media of a quoting post with no words', () => {
    const media = { id: 'm1', type: 'image', url: 'https://wired.example/m1.png' };
    const one = status('q', { content: '', media_attachments: [media] });
    const two = status('q', { content: '', media_attachments: [media, { ...media, id: 'm2' }] });

    expect(say(note('quote', { status: one }))).toBe(
      '@lain@wired.example quoted [a3] (1 attachment)',
    );
    expect(say(note('quote', { status: two }))).toBe(
      '@lain@wired.example quoted [a3] (2 attachments)',
    );
  });

  it('says a quote with no status at all only that it quoted', () => {
    expect(say(note('quote'))).toBe('@lain@wired.example quoted');
  });

  it('says an edit of a quoting post is an edit of a post that quotes yours', () => {
    expect(say(note('quoted_update', { status: status('q') }))).toBe(
      '@lain@wired.example edited a post that quotes yours',
    );
  });

  it('says an update is an edit of the labelled post', () => {
    expect(say(note('update', { status: status('u', { content: '<p>v2</p>' }) }))).toBe(
      '@lain@wired.example edited [a3] "v2"',
    );
  });
});

describe('admin and report notifications', () => {
  it('says an account signed up', () => {
    expect(say(note('admin.sign_up'))).toBe('@lain@wired.example signed up');
  });

  it('names the target and the comment of a Mastodon report', () => {
    const report = { id: 'r1', comment: 'spam links', target_account: TARGET };

    expect(say(note('admin.report', { report }))).toBe(
      '@lain@wired.example filed a report on @eve@bad.example "spam links"',
    );
  });

  it('names the target and the content of a Pleroma report', () => {
    const report = { id: 'r2', content: '<p>rude</p>', account: TARGET };

    expect(say(note('pleroma:report', { report }))).toBe(
      '@lain@wired.example filed a report on @eve@bad.example "rude"',
    );
  });

  it('completes a local target with the viewer origin', () => {
    const report = { id: 'r3', comment: '', target_account: { ...TARGET, acct: 'eve' } };

    expect(say(note('admin.report', { report }))).toBe(
      '@lain@wired.example filed a report on @eve@wired.example',
    );
  });

  it('says a report with no body only that it was filed', () => {
    expect(say(note('admin.report'))).toBe('@lain@wired.example filed a report');
  });

  it('says a moderation action severed relationships', () => {
    expect(say(note('severed_relationships'))).toBe(
      'a moderation action severed some of your follows or followers',
    );
  });

  it('says the viewer received a moderation warning', () => {
    expect(say(note('moderation_warning'))).toBe('you received a moderation warning');
  });

  it('says the annual report is ready', () => {
    expect(say(note('annual_report'))).toBe('your annual report is ready');
  });
});

describe('chat messages and the unknown type', () => {
  it('prints the text of a chat message', () => {
    const chat = { id: 'c1', content: 'are you there' };

    expect(say(note('pleroma:chat_mention', { chat_message: chat }))).toBe(
      '@lain@wired.example sent you a chat message: "are you there"',
    );
  });

  it('says a chat message with no text has no text', () => {
    expect(say(note('pleroma:chat_mention'))).toBe(
      '@lain@wired.example sent you a chat message: (no text)',
    );
  });

  it('never prints a bare type for a type it does not know', () => {
    expect(say(note('akkoma:something_new'))).toBe(
      '@lain@wired.example: akkoma:something_new notification',
    );
  });
});

describe('poll endings', () => {
  it('says a poll the viewer created ended', () => {
    expect(say(note('poll', { status: status('p') }))).toBe('a poll you created ended [a3]');
  });

  it('says a poll by someone else is one the viewer voted in', () => {
    expect(say(note('poll', { status: status('p') }), OTHER)).toBe(
      'a poll you voted in ended [a3]',
    );
  });

  it('says voted when the viewer is unknown or the poll has no status', () => {
    const unknown: Viewer = { origin: VIEWER.origin, accountId: null };

    expect(say(note('poll', { status: status('p') }), unknown)).toBe(
      'a poll you voted in ended [a3]',
    );
    expect(say(note('poll'))).toBe('a poll you voted in ended');
  });
});
