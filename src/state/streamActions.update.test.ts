/**
 * Tests for the update half of the stream routing: which of an account's open
 * windows a post arriving on its connection is delivered to, and which stay out
 * of it — another account's windows, closed windows, and streams that name no
 * view here. ./streamActions.direct.test.ts covers the conversations.
 */

import { describe, expect, it } from 'vitest';

import { streamActions } from './streamActions';
import { status } from '../test/fixtures';
import {
  arriving,
  closed,
  deliveredTo,
  MINE,
  offscreen,
  opened,
  ORIGIN,
  THEIRS,
} from '../test/streamWindows';
import { type WindowRef, windowId } from '../windows/model';

const HOME: WindowRef = { kind: 'home', accountKey: MINE, target: null };
const THEIR_HOME: WindowRef = { kind: 'home', accountKey: THEIRS, target: null };
const LOCAL: WindowRef = { kind: 'local', accountKey: MINE, target: null };
const FEDERATED: WindowRef = { kind: 'federated', accountKey: MINE, target: null };
const LAIN_TAG: WindowRef = { kind: 'hashtag', accountKey: MINE, target: 'lain' };
const DRONES_TAG: WindowRef = { kind: 'hashtag', accountKey: MINE, target: 'drones' };
const THREAD: WindowRef = { kind: 'thread', accountKey: MINE, target: 's1' };
const PROFILE: WindowRef = { kind: 'profile', accountKey: MINE, target: '9' };

describe('a post arriving on a stream', () => {
  it('is the home timeline for the user stream', () => {
    const fresh = status('s1');

    expect(streamActions(offscreen(HOME), MINE, arriving(['user'], fresh))).toStrictEqual([
      deliveredTo(HOME, fresh),
    ]);
  });

  it('is the local timeline for public:local, and not the federated one', () => {
    const fresh = status('s2');

    expect(
      streamActions(offscreen(LOCAL, FEDERATED), MINE, arriving(['public:local'], fresh)),
    ).toStrictEqual([deliveredTo(LOCAL, fresh)]);
  });

  it('is the federated timeline for public, and not the local one', () => {
    const fresh = status('s3');

    expect(
      streamActions(offscreen(LOCAL, FEDERATED), MINE, arriving(['public'], fresh)),
    ).toStrictEqual([deliveredTo(FEDERATED, fresh)]);
  });

  it('is every window its streams name, in list order and this account only', () => {
    const fresh = status('s4');
    const state = offscreen(HOME, THEIR_HOME, LOCAL, FEDERATED);

    expect(streamActions(state, MINE, arriving(['user', 'public:local'], fresh))).toStrictEqual([
      deliveredTo(HOME, fresh),
      deliveredTo(LOCAL, fresh),
    ]);
  });

  it('is the hashtag window that names the tag, in any case', () => {
    const fresh = status('s5');
    const state = offscreen(LAIN_TAG, DRONES_TAG);

    expect(streamActions(state, MINE, arriving(['hashtag', 'Lain'], fresh))).toStrictEqual([
      deliveredTo(LAIN_TAG, fresh),
    ]);
  });

  it('is the hashtag window even with the # spelled out', () => {
    const fresh = status('s6');
    const state = offscreen(LAIN_TAG, DRONES_TAG, FEDERATED);

    expect(streamActions(state, MINE, arriving(['hashtag', '#LAIN'], fresh))).toStrictEqual([
      deliveredTo(LAIN_TAG, fresh),
    ]);
  });

  it('is no window for a stream that names none of these views', () => {
    const state = offscreen(HOME, THREAD, PROFILE, LAIN_TAG);

    expect(streamActions(state, MINE, arriving(['direct'], status('s7')))).toStrictEqual([]);
  });

  it('is no window for a hashtag nobody is following', () => {
    const state = offscreen(LAIN_TAG);

    expect(streamActions(state, MINE, arriving(['hashtag', 'drones'], status('s8')))).toStrictEqual(
      [],
    );
  });

  it('is no window for a hashtag stream that names no tag', () => {
    const state = offscreen(LAIN_TAG);

    expect(streamActions(state, MINE, arriving(['hashtag'], status('s9')))).toStrictEqual([]);
  });

  it('is no window at all for an account the state no longer lists', () => {
    const state = offscreen(HOME, THEIR_HOME);

    expect(streamActions(state, `${ORIGIN}#gone`, arriving(['user'], status('sa')))).toStrictEqual(
      [],
    );
  });

  it('is no window once the home window is closed', () => {
    const state = closed(offscreen(HOME, LOCAL), HOME);
    const fresh = status('sb');

    expect(state.windows.windows.some((win) => win.id === windowId(HOME))).toBe(false);
    expect(streamActions(state, MINE, arriving(['user', 'public:local'], fresh))).toStrictEqual([
      deliveredTo(LOCAL, fresh),
    ]);
  });

  it('is not the home window of the other account', () => {
    const fresh = status('sc');
    const state = opened([THEIR_HOME], windowId(THEIR_HOME));

    expect(streamActions(state, MINE, arriving(['user'], fresh))).toStrictEqual([]);
  });
});
