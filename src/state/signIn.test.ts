/**
 * Tests for the `signedIn` action and for signing out (WFE-243): the first
 * sign-in makes `stream` and shows it in the single pane of desktop 1 with the
 * status window left open behind it and no home window; a second account joins
 * the stream while it is automatic, but after an edit only a hint is printed
 * and the account gets its own windows; a reader who has feeds, or who
 * deleted `stream`, is not touched; and signing out takes the account's
 * sources out of the feeds.
 */
import { describe, expect, it } from 'vitest';

import { type AppState, initialAppState } from './appState';
import { addSource } from './feeds';
import { appReducer } from './reducer';
import type { AppAction } from './reducer';
import { DEFAULT_SETTINGS } from './settings';
import type { StoredAccount } from '../accounts/accountStore';
import { BOB, LAIN } from '../test/deskFixtures';
import { shownPanes } from '../windows/desktopPanes';
import { activeDesktop } from '../windows/desktops';
import { STATUS_WINDOW_ID, windowId } from '../windows/model';

const NOW = new Date('2026-11-25T10:00:00.000Z');
const STREAM_ID = windowId({ kind: 'feed', accountKey: null, target: 'f1' });

/** Signs {@link account} in, as `adoptAccount` does: the account list first, then the news of it. */
function signIn(
  state: AppState,
  account: StoredAccount,
  others: readonly StoredAccount[] = [],
): AppState {
  const actions: readonly AppAction[] = [
    { type: 'accounts', accounts: [...others, account], activeKey: account.key },
    { type: 'signedIn', account, date: NOW },
  ];
  return actions.reduce(appReducer, state);
}

/** The titles of the open windows, in order. */
function titles(state: AppState): readonly string[] {
  return state.windows.windows.map((win) => win.title);
}

/** The texts printed in the status window. */
function statusTexts(state: AppState): readonly string[] {
  const lines = state.buffers.get(STATUS_WINDOW_ID)?.lines ?? [];
  return lines.flatMap((line) => (line.kind === 'system' ? [line.text] : []));
}

describe('the first sign-in', () => {
  it('makes the automatic stream feed of the account and marks it made', () => {
    const state = signIn(initialAppState(), LAIN);

    expect(state.settings.streamMade).toBe(true);
    expect(state.settings.feeds).toHaveLength(1);
    expect(state.settings.feeds[0]).toMatchObject({ id: 'f1', name: 'stream', auto: true });
    expect(state.settings.feeds[0]?.sources).toHaveLength(4);
  });

  it('shows the stream alone in desktop 1’s single pane, status open behind it, no home window', () => {
    const state = signIn(initialAppState(), LAIN);

    expect(titles(state)).toStrictEqual(['status', '~stream']);
    expect(state.windows.activeId).toBe(STREAM_ID);
    expect(shownPanes(activeDesktop(state.layout)).map((pane) => pane.windowId)).toStrictEqual([
      STREAM_ID,
    ]);
  });
});

describe('a later sign-in', () => {
  const first = signIn(initialAppState(), LAIN);

  it('adds its four sources to the stream while the reader has not edited it', () => {
    const state = signIn(first, BOB, [LAIN]);

    expect(state.settings.feeds[0]?.sources).toHaveLength(8);
    expect(state.settings.feeds[0]?.auto).toBe(true);
    expect(titles(state)).toStrictEqual(['status', '~stream']);
    expect(statusTexts(state)).toStrictEqual([]);
  });

  it('leaves an edited stream alone, prints the /feed add hint and opens the account’s own windows', () => {
    const feeds = addSource(first.settings.feeds, 'f1', []);
    const edited = appReducer(first, { type: 'settings', settings: { feeds } });

    const state = signIn(edited, BOB, [LAIN]);

    expect(state.settings.feeds).toBe(feeds);
    expect(statusTexts(state)).toStrictEqual([
      '~stream was edited, so @bob@b.example is not in it: /feed add stream ' +
        '@bob@b.example:home @bob@b.example:mentions @bob@b.example:dms @bob@b.example:notifications',
    ]);
    expect(titles(state)).toStrictEqual(['status', '~stream', 'home', 'notifs']);
  });
});

describe('a reader who is not a first run', () => {
  it('keeps the feeds they have and opens the account’s own windows', () => {
    const feeds = [{ id: 'f1', name: 'main', sources: [] }];
    const start = appReducer(initialAppState(), { type: 'settings', settings: { feeds } });

    const state = signIn(start, LAIN);

    expect(state.settings.feeds).toBe(feeds);
    expect(state.settings.streamMade).toBe(false);
    expect(titles(state)).toStrictEqual(['status', 'home', 'notifs']);
  });

  it('does not make the stream again once it was made and deleted', () => {
    const start = appReducer(initialAppState(), {
      type: 'settings',
      settings: { streamMade: true },
    });

    const state = signIn(start, LAIN);

    expect(state.settings.feeds).toStrictEqual(DEFAULT_SETTINGS.feeds);
    expect(titles(state)).toStrictEqual(['status', 'home', 'notifs']);
  });
});

describe('signing out', () => {
  it('takes the account’s sources out of every feed', () => {
    const both = signIn(signIn(initialAppState(), LAIN), BOB, [LAIN]);

    const state = appReducer(both, { type: 'accounts', accounts: [LAIN], activeKey: LAIN.key });

    const sources = state.settings.feeds[0]?.sources ?? [];

    expect(sources).toHaveLength(4);
    expect(sources.every((ref) => ref.accountKey === LAIN.key)).toBe(true);
    expect(state.settings.feeds[0]?.auto).toBe(true);
  });

  it('changes nothing when the list only changes its active account', () => {
    const both = signIn(signIn(initialAppState(), LAIN), BOB, [LAIN]);

    const state = appReducer(both, {
      type: 'accounts',
      accounts: both.accounts,
      activeKey: LAIN.key,
    });

    expect(state.settings.feeds).toBe(both.settings.feeds);
  });
});
