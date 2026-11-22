/**
 * Tests for the rest of the stream routing: a notification joining the window of
 * the account its connection belongs to, a mention announced where the reader
 * actually is when that window is not what they are looking at, an edit or a
 * delete applied once for every scrollback whoever arrived on, and an event the
 * client does not act on asking for nothing at all.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import type { AppState } from './appState';
import type { BufferAction } from './bufferActions';
import type { AppAction } from './reducer';
import { streamActions } from './streamActions';
import { type Notification, NotificationSchema } from '../api/schemas/notification';
import type { StreamEvent } from '../api/streaming';
import { notification, status, TEST_DATE } from '../test/fixtures';
import { MINE, offscreen, opened, ORIGIN, THEIRS, wireActor } from '../test/streamWindows';
import { type WindowRef, windowId } from '../windows/model';

const NOTIFS: WindowRef = { kind: 'notifications', accountKey: MINE, target: null };
const THEIR_NOTIFS: WindowRef = { kind: 'notifications', accountKey: THEIRS, target: null };
const HOME: WindowRef = { kind: 'home', accountKey: MINE, target: null };

/** The notifications window of the account under test, open and on screen. */
function watching(): AppState {
  return opened([NOTIFS], windowId(NOTIFS));
}

/** A mention notification from an actor the backend reports as {@link acct}. */
function mention(acct: string): Notification {
  return v.parse(NotificationSchema, {
    id: `notice-${acct}`,
    type: 'mention',
    created_at: TEST_DATE,
    account: wireActor(acct),
    status: status('the word'),
  });
}

/** A notification of {@link shown}, on the account under test's connection. */
function flagged(shown: Notification): StreamEvent {
  return { kind: 'notification', stream: ['user:notification'], notification: shown };
}

/** What the window {@link view} is asked to grow by {@link shown}. */
function into(view: WindowRef, shown: Notification): NotificationsAction {
  return {
    type: 'notifications',
    windowId: windowId(view),
    notifications: [shown],
    where: 'newer',
  };
}

/** The notifications action {@link into} builds, in the shape the reducer owns. */
type NotificationsAction = Extract<BufferAction, { readonly type: 'notifications' }>;

/** Where a client message goes and how loud it is, without its clock stamp. */
type Printed = { readonly windowId: string | null; readonly level: string; readonly text: string };

/** The client messages among {@link actions}, so a test can count the noise. */
function printed(actions: readonly AppAction[]): readonly Printed[] {
  return actions.flatMap((action) =>
    action.type === 'print'
      ? [{ windowId: action.windowId, level: action.level, text: action.text }]
      : [],
  );
}

/** The buffer transitions among {@link actions}: everything but a print. */
function buffered(actions: readonly AppAction[]): readonly AppAction[] {
  return actions.filter((action) => action.type !== 'print');
}

/** The line a mention leaves behind for an actor named {@link handle}. */
function mentionsYou(handle: string): Printed {
  return { windowId: null, level: 'info', text: `@${handle} mentioned you [see notifs]` };
}

describe('a notification', () => {
  it('joins the notifications window of its own account, and stays quiet there', () => {
    const shown = notification('n1', status('s1'));

    expect(streamActions(watching(), MINE, flagged(shown))).toStrictEqual([into(NOTIFS, shown)]);
  });

  it('joins that window and not the other account’s', () => {
    const shown = notification('n1', null);
    const state = opened([NOTIFS, THEIR_NOTIFS], windowId(THEIR_NOTIFS));

    expect(streamActions(state, MINE, flagged(shown))).toStrictEqual([into(NOTIFS, shown)]);
  });

  it('is nowhere to go when no notifications window is open', () => {
    expect(streamActions(offscreen(HOME), MINE, flagged(notification('n1', null)))).toStrictEqual(
      [],
    );
  });

  it('asks for nothing at all for an account the state no longer lists', () => {
    expect(
      streamActions(watching(), `${ORIGIN}#gone`, flagged(notification('n1', null))),
    ).toStrictEqual([]);
  });

  it('prints a mention where the reader is, when that window is not on screen', () => {
    const shown = mention('ally@wired.example');
    const state = opened([NOTIFS, HOME], windowId(HOME));

    const actions = streamActions(state, MINE, flagged(shown));

    expect(buffered(actions)).toStrictEqual([into(NOTIFS, shown)]);
    expect(printed(actions)).toStrictEqual([mentionsYou('ally@wired.example')]);
  });

  it('names the actor with the host of the account they came from', () => {
    const actions = streamActions(offscreen(HOME), MINE, flagged(mention('ally')));

    expect(printed(actions)).toStrictEqual([mentionsYou('ally@wired.example')]);
  });

  it('says nothing for a follow, however far the reader is from the window', () => {
    const shown = notification('n2', null);
    const state = opened([NOTIFS, HOME], windowId(HOME));

    const actions = streamActions(state, MINE, flagged(shown));

    expect(buffered(actions)).toStrictEqual([into(NOTIFS, shown)]);
    expect(printed(actions)).toStrictEqual([]);
  });

  it('leaves the window it opened for itself: a mention prints once only', () => {
    const state = opened([HOME], windowId(HOME));

    expect(
      printed(streamActions(state, MINE, flagged(mention('ally@wired.example')))),
    ).toStrictEqual([mentionsYou('ally@wired.example')]);
  });
});

describe('a status edited or deleted on the wire', () => {
  it('is one update action, however many windows are open', () => {
    const edited = status('s1', { content: '<p>corrected</p>' });
    const event: StreamEvent = { kind: 'statusUpdate', stream: ['user'], status: edited };

    expect(streamActions(opened([HOME, NOTIFS], windowId(NOTIFS)), MINE, event)).toStrictEqual([
      { type: 'statusUpdated', status: edited },
    ]);
  });

  it('is one update action even for an account the state does not list', () => {
    const edited = status('s1');
    const event: StreamEvent = { kind: 'statusUpdate', stream: ['user'], status: edited };

    expect(streamActions(offscreen(HOME), `${ORIGIN}#gone`, event)).toStrictEqual([
      { type: 'statusUpdated', status: edited },
    ]);
  });

  it('is one delete action naming the status that is gone', () => {
    const event: StreamEvent = { kind: 'delete', stream: ['public'], id: 's1' };

    expect(streamActions(opened([HOME, NOTIFS], windowId(HOME)), MINE, event)).toStrictEqual([
      { type: 'statusDeleted', id: 's1' },
    ]);
  });
});

describe('an event the client does not act on', () => {
  it('asks for nothing', () => {
    const event: StreamEvent = { kind: 'other', event: 'filters_changed' };

    expect(streamActions(opened([HOME, NOTIFS], windowId(HOME)), MINE, event)).toStrictEqual([]);
  });
});
