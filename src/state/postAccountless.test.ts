/**
 * Tests for posting from windows with no account (WFE-284): the feed, the
 * status window and a people window that watches one post as the feed's
 * default, the global one or the only account at once and confirm with
 * `posted as @handle`; a draft with media posts as the active account; with
 * nobody resolved the picker opens in post mode, holding the draft, and nothing
 * is posted. A people window with an account of its own still posts as it.
 */
import { describe, expect, it } from 'vitest';

import type { FeedSpec } from './feeds';
import { feedWindowOpen } from './feedWindow';
import { peopleWindowOpen } from './peopleWindow';
import { postAccountless, postAsWindowOrChoice } from './postAccountless';
import type { AppAction } from './reducer';
import { stateAfter } from '../test/appSessions';
import { runKindPost } from '../test/kindPost';
import { ALICE, LAIN } from '../test/splitDesk';
import { STATUS_WINDOW_ID, activeWindow } from '../windows/model';
import type { WindowState } from '../windows/model';

const ORIGIN = 'https://wired.example';

/** A feed with no posting default. */
const MAIN: FeedSpec = { id: 'f1', name: 'main', sources: [] };

/** The kind as the app would register it. */
const KIND = { onPost: postAccountless };

/** Two accounts, lain active, with the feed saved and its window open and active. */
const BASE: readonly AppAction[] = [
  { type: 'accounts', accounts: [LAIN, ALICE], activeKey: LAIN.key },
  { type: 'settings', settings: { feeds: [MAIN] } },
  { type: 'windows', action: feedWindowOpen(MAIN) },
];

/** The session after {@link BASE} and {@link more}, and its active window. */
function session(more: readonly AppAction[] = []): {
  readonly state: ReturnType<typeof stateAfter>;
  readonly win: WindowState;
} {
  const state = stateAfter([...BASE, ...more]);
  return { state, win: activeWindow(state.windows) };
}

describe(postAccountless, () => {
  it('posts as the feed’s default at once and confirms it', async () => {
    const { state, win } = session([
      { type: 'settings', settings: { feeds: [{ ...MAIN, postAs: ALICE.key }] } },
    ]);

    const run = await runKindPost(KIND, { state, win, origin: ORIGIN }, 'sup');

    expect(run.result).toBeNull();
    expect(run.bodies).toStrictEqual([{ status: 'sup', visibility: 'public' }]);
    expect(run.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'print', text: 'posted as @alice@wired.example' }),
    );
  });

  it('posts as the global default at once', async () => {
    const { state, win } = session([{ type: 'settings', settings: { postAs: ALICE.key } }]);

    const run = await runKindPost(KIND, { state, win, origin: ORIGIN }, 'sup');

    expect(run.result).toBeNull();
    expect(run.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'posted as @alice@wired.example' }),
    );
  });

  it('posts as the only account at once', async () => {
    const { state, win } = session([{ type: 'accounts', accounts: [ALICE], activeKey: ALICE.key }]);

    const run = await runKindPost(KIND, { state, win, origin: ORIGIN }, 'sup');

    expect(run.result).toBeNull();
    expect(run.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'posted as @alice@wired.example' }),
    );
  });

  it('opens the picker with the draft and posts nothing when nobody resolves', async () => {
    const { state, win } = session();

    const run = await runKindPost(
      KIND,
      { state, win, origin: ORIGIN },
      { text: 'sup', spoilerText: 'cw' },
    );

    expect(run.result).toBeNull();
    expect(run.bodies).toStrictEqual([]);
    expect(run.dispatch).toHaveBeenCalledTimes(1);
    expect(run.dispatch).toHaveBeenCalledWith({
      type: 'openAccountPick',
      pick: { purpose: 'post', windowId: win.id, draft: { text: 'sup', spoilerText: 'cw' } },
    });
  });

  it('posts a draft with media as the active account despite a feed default', async () => {
    const { state, win } = session([
      { type: 'settings', settings: { feeds: [{ ...MAIN, postAs: ALICE.key }] } },
    ]);

    const run = await runKindPost(
      KIND,
      { state, win, origin: ORIGIN },
      { text: 'sup', mediaIds: ['m1'] },
    );

    expect(run.result).toBeNull();
    expect(run.bodies).toStrictEqual([{ status: 'sup', visibility: 'public', media_ids: ['m1'] }]);
    expect(run.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'posted as @lain@wired.example' }),
    );
  });

  it('refuses a draft with media when no account is active', async () => {
    const { state, win } = session([
      { type: 'accounts', accounts: [LAIN, ALICE], activeKey: null },
    ]);

    const run = await runKindPost(
      KIND,
      { state, win, origin: ORIGIN },
      { text: 'sup', mediaIds: ['m1'] },
    );

    expect(run.result).toBe("You can't post in this window");
    expect(run.bodies).toStrictEqual([]);
  });

  it('resolves the instance’s error', async () => {
    const { state, win } = session([{ type: 'settings', settings: { postAs: ALICE.key } }]);

    const run = await runKindPost(KIND, { state, win, origin: ORIGIN, refused: true }, 'sup');

    expect(run.result).toBe('HTTP 422: Text is too long');
  });

  it('behaves the same in the status window', async () => {
    const state = stateAfter([{ type: 'accounts', accounts: [LAIN, ALICE], activeKey: LAIN.key }]);
    const win = activeWindow(state.windows);

    expect(win.id).toBe(STATUS_WINDOW_ID);

    const run = await runKindPost(KIND, { state, win, origin: ORIGIN }, 'sup');

    expect(run.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'openAccountPick' }));
  });

  it('refuses when nobody is signed in', async () => {
    const state = stateAfter([]);
    const win = activeWindow(state.windows);

    const run = await runKindPost(KIND, { state, win, origin: ORIGIN }, 'sup');

    expect(run.result).toBe('Not logged in. Type /connect');
    expect(run.dispatch).not.toHaveBeenCalled();
  });
});

describe(postAsWindowOrChoice, () => {
  const PEOPLE = { onPost: postAsWindowOrChoice };

  /** The people window of the feed (no account) or of lain's home. */
  function peopleOf(feed: boolean): ReturnType<typeof session> {
    const open: AppAction[] = feed
      ? []
      : [
          {
            type: 'windows',
            action: {
              type: 'open',
              ref: { kind: 'home', accountKey: LAIN.key, target: null },
              title: 'home',
            },
          },
        ];
    const watched = session(open);
    const people = stateAfter([
      ...BASE,
      ...open,
      { type: 'windows', action: peopleWindowOpen(watched.win) },
    ]);
    return { state: people, win: activeWindow(people.windows) };
  }

  it('opens the picker for a people window that watches a feed', async () => {
    const { state, win } = peopleOf(true);

    const run = await runKindPost(PEOPLE, { state, win, origin: ORIGIN }, 'sup');

    expect(run.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'openAccountPick' }));
  });

  it('posts as the watched window’s account when it has one', async () => {
    const { state, win } = peopleOf(false);

    const run = await runKindPost(PEOPLE, { state, win, origin: ORIGIN }, 'sup');

    expect(run.bodies).toStrictEqual([{ status: 'sup', visibility: 'public' }]);
    expect(run.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'posted as @lain@wired.example' }),
    );
  });
});
