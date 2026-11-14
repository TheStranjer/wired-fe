/**
 * Tests for what an off-screen window has missed: which of a buffer's lines count
 * as having arrived, and which of those make the tally a highlight. The window on
 * screen has nothing to miss, a window that is not open has nobody to tell, and a
 * window owned by nobody can still be written to.
 */

import { describe, expect, it } from 'vitest';

import { type AppState, coreReducer, initialAppState } from './appState';
import { type Buffer, EMPTY_BUFFER, type LineData } from './buffer';
import { addedLines, markArrivals } from './bufferUnread';
import type { StoredAccount } from '../accounts/accountStore';
import type { Notification } from '../api/schemas/notification';
import type { Status } from '../api/schemas/status';
import { notification, status } from '../test/fixtures';
import { STATUS_WINDOW_ID, windowId } from '../windows/model';
import type { WindowRef, WindowsState, WindowState } from '../windows/model';

const ORIGIN = 'https://wired.example';
const MY_ID = 'acct-1';
const MY_KEY = `${ORIGIN}#${MY_ID}`;

/** The account the windows here belong to. */
const ACCOUNT: StoredAccount = {
  key: MY_KEY,
  origin: ORIGIN,
  accountId: MY_ID,
  handle: 'lain@wired.example',
  token: 'never-logged',
};

const HOME: WindowRef = { kind: 'home', accountKey: MY_KEY, target: null };
const HOME_ID = windowId(HOME);

/** Window 1 and a home window, with {@link active} the one on screen. */
function opened(active: string): AppState {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: MY_KEY,
  });
  const shown = coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
  return coreReducer(shown, { type: 'windows', action: { type: 'activate', id: active } });
}

/** The home window off screen, so it can miss something. */
const OFFSCREEN = opened(STATUS_WINDOW_ID);

/** The home window on screen, so it misses nothing. */
const ON_HOME = opened(HOME_ID);

/** A post line, as the buffer's own transitions would key it. */
function postLine(shown: Status): LineData {
  return { kind: 'post', key: `post:${shown.id}`, status: shown };
}

/** A notification line, as the buffer's own transitions would key it. */
function notifLine(note: Notification): LineData {
  return { kind: 'notification', key: `notif:${note.id}`, notification: note };
}

/** A buffer holding {@link lines}. */
function holding(...lines: LineData[]): Buffer {
  return { ...EMPTY_BUFFER, lines };
}

/** The window {@link windows} lists under {@link id}. */
function windowIn(windows: WindowsState, id: string): WindowState {
  const win = windows.windows.find((candidate) => candidate.id === id);
  if (win === undefined) {
    throw new Error(`no window ${id}`);
  }
  return win;
}

/** A post that mentions the account under test. */
function mentioningMe(id: string): Status {
  return status(id, {
    mentions: [{ id: MY_ID, username: 'lain', acct: 'lain@wired.example', url: `${ORIGIN}/@lain` }],
  });
}

describe(addedLines, () => {
  it('reports the lines that joined, oldest first', () => {
    const before = holding(postLine(status('a')));

    const after = holding(
      postLine(status('a')),
      postLine(status('b')),
      notifLine(notification('n1', null)),
    );

    expect(addedLines(before, after).map((line) => line.key)).toStrictEqual(['post:b', 'notif:n1']);
  });

  it('reports nothing for a buffer that stands where it was', () => {
    const lines = holding(postLine(status('a')));

    expect(addedLines(lines, lines)).toStrictEqual([]);
    expect(addedLines(holding(), holding())).toStrictEqual([]);
  });

  it('also reports lines that joined above what the buffer had, which older history does', () => {
    const before = holding(postLine(status('a')));

    const after = holding(postLine(status('older')), postLine(status('a')));

    expect(addedLines(before, after)).toStrictEqual([postLine(status('older'))]);
  });
});

describe(markArrivals, () => {
  it('counts what the window missed', () => {
    const added = [postLine(status('a')), postLine(status('b'))];

    expect(windowIn(markArrivals(OFFSCREEN, HOME_ID, added), HOME_ID).unread).toBe(2);
  });

  it('keeps counting what a window already missed', () => {
    const missedOne: AppState = {
      ...OFFSCREEN,
      windows: markArrivals(OFFSCREEN, HOME_ID, [postLine(status('a'))]),
    };

    const next = markArrivals(missedOne, HOME_ID, [postLine(status('b'))]);

    expect(windowIn(next, HOME_ID)).toStrictEqual({
      ...windowIn(OFFSCREEN.windows, HOME_ID),
      unread: 2,
    });
  });

  it('leaves the windows alone when nothing arrived', () => {
    expect(markArrivals(OFFSCREEN, HOME_ID, [])).toBe(OFFSCREEN.windows);
  });

  it('leaves the window on screen alone, which has seen it all', () => {
    expect(markArrivals(ON_HOME, HOME_ID, [postLine(status('a'))])).toBe(ON_HOME.windows);
  });

  it('leaves a window that is not open alone', () => {
    const windows = markArrivals(OFFSCREEN, 'nope:nope:nope', [postLine(status('a'))]);

    expect(windows).toBe(OFFSCREEN.windows);
  });

  it('highlights the window for a post that mentions its account', () => {
    const next = markArrivals(OFFSCREEN, HOME_ID, [
      postLine(status('x')),
      postLine(mentioningMe('y')),
    ]);

    expect(windowIn(next, HOME_ID).highlight).toBe(true);
  });

  it('highlights the window for a post aimed at it alone', () => {
    const next = markArrivals(OFFSCREEN, HOME_ID, [
      postLine(status('d', { visibility: 'direct' })),
    ]);

    expect(windowIn(next, HOME_ID)).toStrictEqual({
      ...windowIn(OFFSCREEN.windows, HOME_ID),
      unread: 1,
      highlight: true,
    });
  });

  it('highlights the window for a mention notification', () => {
    const next = markArrivals(OFFSCREEN, HOME_ID, [
      notifLine(notification('n1', status('s'))),
      postLine(status('t')),
    ]);

    expect(windowIn(next, HOME_ID).highlight).toBe(true);
  });

  it('does not highlight for a follow, a stranger or a mention of somebody else', () => {
    const next = markArrivals(OFFSCREEN, HOME_ID, [
      notifLine(notification('n1', null)),
      postLine(status('p')),
      postLine(
        status('m', {
          mentions: [{ id: 'other', username: 'o', acct: 'o@x', url: 'https://x/@o' }],
        }),
      ),
    ]);

    expect(windowIn(next, HOME_ID)).toStrictEqual({
      ...windowIn(OFFSCREEN.windows, HOME_ID),
      unread: 3,
    });
  });

  it('still notices a direct message in a window no account owns', () => {
    const atHome = opened(HOME_ID);

    const next = markArrivals(atHome, STATUS_WINDOW_ID, [
      postLine(status('d', { visibility: 'direct' })),
    ]);

    expect(windowIn(next, STATUS_WINDOW_ID)).toStrictEqual({
      ...windowIn(atHome.windows, STATUS_WINDOW_ID),
      unread: 1,
      highlight: true,
    });
  });

  it('marks the window the account is signed out of as unhighlighted', () => {
    const signedOut: AppState = { ...OFFSCREEN, accounts: [], activeAccountKey: null };

    const next = markArrivals(signedOut, HOME_ID, [postLine(mentioningMe('y'))]);

    expect(windowIn(next, HOME_ID)).toStrictEqual({
      ...windowIn(OFFSCREEN.windows, HOME_ID),
      unread: 1,
    });
  });
});
