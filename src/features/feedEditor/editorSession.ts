/**
 * The session the feed editor tests share (AGENTS.md "Testing"): lain and alice
 * signed in on one Wired instance, two saved feeds — `main`, reading lain's
 * home and alice's `#rust`, and `quiet`, reading nothing — and an editor open
 * on one of them or on a new feed. Built through the real reducer, so a window
 * sees what the app would have shown it.
 */
import { accountKey, type StoredAccount } from '../../accounts/accountStore';
import { type AppState, initialAppState } from '../../state/appState';
import { feedEditorOpen } from '../../state/feedEditorWindow';
import type { FeedSpec } from '../../state/feeds';
import { type AppAction, appReducer } from '../../state/reducer';
import { windowId } from '../../windows/model';

const ORIGIN = 'https://wired.example';

/** An account of the instance. */
function accountOf(id: string, handle: string): StoredAccount {
  return {
    key: accountKey(ORIGIN, id),
    origin: ORIGIN,
    accountId: id,
    handle,
    token: `token-${id}`,
    refreshToken: null,
    expiresAt: null,
  };
}

/** The first signed-in account, which is active. */
export const LAIN = accountOf('1', 'lain@wired.example');

/** The second signed-in account. */
export const ALICE = accountOf('2', 'alice@wired.example');

/** A saved feed that reads lain's home and alice's `#rust`. */
export const MAIN: FeedSpec = {
  id: 'f1',
  name: 'main',
  sources: [
    { accountKey: LAIN.key, source: 'home' },
    { accountKey: ALICE.key, source: 'tag:rust' },
  ],
};

/** A saved feed that reads nothing. */
export const QUIET: FeedSpec = { id: 'f2', name: 'quiet', sources: [] };

/** The id of the window that edits {@link feed}, or a new feed when it is null. */
export function editorWindowId(feed: FeedSpec | null): string {
  return windowId({
    kind: 'feedEditor',
    accountKey: null,
    target: feed === null ? 'new' : feed.id,
  });
}

/** The session with {@link MAIN} and {@link QUIET} saved and an editor of {@link feed} open, moved on by {@link more}. */
export function editorSession(feed: FeedSpec | null, more: readonly AppAction[] = []): AppState {
  const actions: readonly AppAction[] = [
    { type: 'accounts', accounts: [LAIN, ALICE], activeKey: LAIN.key },
    { type: 'settings', settings: { feeds: [MAIN, QUIET] } },
    { type: 'windows', action: feedEditorOpen(feed) },
    ...more,
  ];
  return actions.reduce(appReducer, initialAppState());
}
