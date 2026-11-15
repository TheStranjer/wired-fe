/**
 * Table tests for ./notificationText: one row per normalized kind, the words the
 * `***` line shows. They pin the sentences the ticket specifies, the `@handle`
 * the actor is named by, the `[label]` dropped when the status carries none, the
 * quoted plain-text excerpt of the status, its 60-character trim, and the raw
 * type the unknown kinds fall back to.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { notificationText } from './notificationText';
import { type Notification, NotificationSchema } from '../api/schemas/notification';
import type { Status } from '../api/schemas/status';
import { status, TEST_DATE } from '../test/fixtures';

const ORIGIN = 'https://wired.example';

/** The actor every test notification names: a local account of the instance. */
const AUTHOR = status('author').account;

/** A status whose words become the quoted excerpt of the kinds that show them. */
function target(content = '<p>present day, present time</p>'): Status {
  return status('t1', { content });
}

/** One notification, its kind chosen from the raw type the way the schema maps it. */
function note(
  type: string,
  shown: Status | null = null,
  emoji: string | null = null,
): Notification {
  return v.parse(NotificationSchema, {
    id: 'n1',
    type,
    created_at: TEST_DATE,
    account: AUTHOR,
    status: shown,
    emoji,
  });
}

describe(notificationText, () => {
  it('names a favourite the actor, the label and the quoted excerpt', () => {
    expect(notificationText(note('favourite', target()), 'a3', ORIGIN)).toBe(
      '@lain@wired.example favourited [a3] "present day, present time"',
    );
  });

  it('calls a reblog a boost', () => {
    expect(notificationText(note('reblog', target()), 'a3', ORIGIN)).toBe(
      '@lain@wired.example boosted [a3] "present day, present time"',
    );
  });

  it('puts the emoji between reacted and to for a reaction', () => {
    expect(notificationText(note('pleroma:emoji_reaction', target(), '🎉'), 'a3', ORIGIN)).toBe(
      '@lain@wired.example reacted 🎉 to [a3] "present day, present time"',
    );
  });

  it('says a follow is a follow, with no label or excerpt', () => {
    expect(notificationText(note('follow'), 'a3', ORIGIN)).toBe('@lain@wired.example followed you');
  });

  it('points a follow request at the commands that answer it', () => {
    expect(notificationText(note('follow_request'), null, ORIGIN)).toBe(
      '@lain@wired.example wants to follow you (/accept or /reject coming later)',
    );
  });

  it('ends a poll without an actor, on the label alone', () => {
    expect(notificationText(note('poll', target()), 'a3', ORIGIN)).toBe(
      'a poll you voted in ended [a3]',
    );
  });

  it('calls an update an edit of the labelled status', () => {
    expect(notificationText(note('update', target()), 'a3', ORIGIN)).toBe(
      '@lain@wired.example edited [a3] "present day, present time"',
    );
  });

  it('says a move only that the actor moved', () => {
    expect(notificationText(note('move'), null, ORIGIN)).toBe('@lain@wired.example moved');
  });

  it('posts a plain status under its label, with no excerpt', () => {
    expect(notificationText(note('status', target()), 'a3', ORIGIN)).toBe(
      '@lain@wired.example posted [a3]',
    );
  });

  it('names an unrecognized kind by the raw type it came in as', () => {
    expect(notificationText(note('admin.sign_up'), null, ORIGIN)).toBe(
      '@lain@wired.example admin.sign_up',
    );
  });

  it('names a mention by its raw type, though the line shows the post itself', () => {
    expect(notificationText(note('mention', target()), 'a3', ORIGIN)).toBe(
      '@lain@wired.example mention',
    );
  });

  it('drops the bracketed label when the status carries none', () => {
    expect(notificationText(note('favourite', target()), null, ORIGIN)).toBe(
      '@lain@wired.example favourited "present day, present time"',
    );
    expect(notificationText(note('status', target()), null, ORIGIN)).toBe(
      '@lain@wired.example posted',
    );
    expect(notificationText(note('poll', target()), null, ORIGIN)).toBe(
      'a poll you voted in ended',
    );
  });

  it('flattens the status markup to one quoted plain line', () => {
    const messy = note('favourite', target('<p>  close\n\tthe world </p><script>steal()</script>'));

    expect(notificationText(messy, 'a3', ORIGIN)).toBe(
      '@lain@wired.example favourited [a3] "close the world"',
    );
  });

  it('trims a long excerpt to 60 characters with an ellipsis', () => {
    const long = note('favourite', target(`<p>${'x'.repeat(70)}</p>`));

    expect(notificationText(long, null, ORIGIN)).toBe(
      `@lain@wired.example favourited "${'x'.repeat(60)}…"`,
    );
  });

  it('keeps a not-quite-long excerpt whole', () => {
    const exact = 'y'.repeat(60);
    const kept = note('favourite', target(`<p>${exact}</p>`));

    expect(notificationText(kept, null, ORIGIN)).toBe(`@lain@wired.example favourited "${exact}"`);
  });

  it('quotes an empty excerpt for a status with no words', () => {
    expect(notificationText(note('favourite', target('')), 'a3', ORIGIN)).toBe(
      '@lain@wired.example favourited [a3] ""',
    );
  });

  it('shows a reaction with no emoji as a plain react', () => {
    expect(notificationText(note('reaction', target(), null), 'a3', ORIGIN)).toBe(
      '@lain@wired.example reacted to [a3] "present day, present time"',
    );
  });

  it('completes a local actor with the window origin', () => {
    const bare = v.parse(NotificationSchema, {
      id: 'n1',
      type: 'follow',
      created_at: TEST_DATE,
      account: { ...AUTHOR, acct: 'bob' },
      status: null,
    });

    expect(notificationText(bare, null, ORIGIN)).toBe('@bob@wired.example followed you');
  });
});
