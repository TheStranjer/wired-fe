/**
 * Tests for the direct half of the update routing: a private post on an
 * account's own stream joins its home timeline and, besides that, the
 * conversation window of every party it is between — the author or anybody it
 * mentions, by handle as /query keys a window by or as the backend reports the
 * actor. A post that is not direct, a window of somebody else in the
 * conversation, and a stream that is not the account's own all reach nothing.
 */

import { describe, expect, it } from 'vitest';

import { streamActions } from './streamActions';
import { status } from '../test/fixtures';
import {
  arriving,
  deliveredTo,
  mentioning,
  MINE,
  offscreen,
  wireActor,
} from '../test/streamWindows';
import type { WindowRef } from '../windows/model';

const HOME: WindowRef = { kind: 'home', accountKey: MINE, target: null };
const BOBS_DM: WindowRef = { kind: 'dm', accountKey: MINE, target: 'bob@wired.example' };
const CAROLS_DM: WindowRef = { kind: 'dm', accountKey: MINE, target: 'carol@wired.example' };
const BOB_ELSEWHERE: WindowRef = { kind: 'dm', accountKey: MINE, target: 'bob@other.example' };
const TARGETLESS: WindowRef = { kind: 'dm', accountKey: MINE, target: null };

describe('a direct post on the user stream', () => {
  it('joins the home window and the window of the account it mentions', () => {
    const fresh = status('d1', {
      visibility: 'direct',
      mentions: [mentioning('bob@wired.example')],
    });
    const state = offscreen(HOME, BOBS_DM, CAROLS_DM);

    expect(streamActions(state, MINE, arriving(['user'], fresh))).toStrictEqual([
      deliveredTo(HOME, fresh),
      deliveredTo(BOBS_DM, fresh),
    ]);
  });

  it('joins the window of the author, when the post mentions nobody else', () => {
    const fresh = status('d2', {
      visibility: 'direct',
      account: wireActor('bob@other.example'),
    });
    const state = offscreen(BOB_ELSEWHERE, CAROLS_DM);

    expect(streamActions(state, MINE, arriving(['user'], fresh))).toStrictEqual([
      deliveredTo(BOB_ELSEWHERE, fresh),
    ]);
  });

  it('finds the window by full handle when the backend names a local username', () => {
    const fresh = status('d3', { visibility: 'direct', mentions: [mentioning('bob')] });
    const state = offscreen(BOBS_DM);

    expect(streamActions(state, MINE, arriving(['user'], fresh))).toStrictEqual([
      deliveredTo(BOBS_DM, fresh),
    ]);
  });

  it('finds the window keyed by a username when the post names a full handle', () => {
    const bare: WindowRef = { kind: 'dm', accountKey: MINE, target: 'Bob' };
    const fresh = status('d4', { visibility: 'direct', account: wireActor('Bob') });

    expect(streamActions(offscreen(bare), MINE, arriving(['user'], fresh))).toStrictEqual([
      deliveredTo(bare, fresh),
    ]);
  });

  it('is not the conversation window of anybody else in it', () => {
    const fresh = status('d5', {
      visibility: 'direct',
      mentions: [mentioning('bob@wired.example')],
    });
    const state = offscreen(CAROLS_DM);

    expect(streamActions(state, MINE, arriving(['user'], fresh))).toStrictEqual([]);
  });

  it('is not the conversation window for a post that is not direct', () => {
    const fresh = status('d6', {
      visibility: 'private',
      mentions: [mentioning('bob@wired.example')],
    });
    const state = offscreen(BOBS_DM);

    expect(streamActions(state, MINE, arriving(['user'], fresh))).toStrictEqual([]);
  });

  it('is not the home window when the user stream is not named', () => {
    const fresh = status('d7', { visibility: 'direct', mentions: [mentioning('bob')] });
    const state = offscreen(HOME, BOBS_DM);

    expect(streamActions(state, MINE, arriving(['direct'], fresh))).toStrictEqual([]);
  });

  it('is not a conversation window with nothing to target', () => {
    const fresh = status('d8', { visibility: 'direct', account: wireActor('lain') });

    expect(streamActions(offscreen(TARGETLESS), MINE, arriving(['user'], fresh))).toStrictEqual([]);
  });
});
