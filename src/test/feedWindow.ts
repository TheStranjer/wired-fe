/**
 * The signed-in feed window the feed tests share (AGENTS.md "Testing"): two
 * accounts on two instances, a saved feed list, one `feed` window opened the
 * way the `/feed` commands will open it (a ref with no account and the feed's
 * id as its target), built through the real reducers; and a one-line reading of
 * a scrollback — every line as `id@account`, notifications and client messages
 * spelled out — so a test can assert what the window shows in one string.
 */

import { type StoredAccount, accountKey } from '../accounts/accountStore';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import type { Buffer } from '../state/buffer';
import type { Feeds } from '../state/feeds';
import { type WindowRef, windowId } from '../windows/model';

/** The instances the two accounts sign in to. */
export const A_ORIGIN = 'https://a.example';
export const B_ORIGIN = 'https://b.example';

/** Lain on the first instance, the active account. */
export const A_ACCOUNT: StoredAccount = {
  key: accountKey(A_ORIGIN, '1'),
  origin: A_ORIGIN,
  accountId: '1',
  handle: 'lain@a.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** Navi on the second instance. */
export const B_ACCOUNT: StoredAccount = {
  key: accountKey(B_ORIGIN, '2'),
  origin: B_ORIGIN,
  accountId: '2',
  handle: 'navi@b.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** The ref of the window showing the feed {@link target}: no account, the feed's id. */
function feedRef(target: string | null): WindowRef {
  return { kind: 'feed', accountKey: null, target };
}

/** The id of the window showing the feed {@link target}. */
export function feedWindowId(target: string | null): string {
  return windowId(feedRef(target));
}

/**
 * A session with both accounts signed in, {@link feeds} saved, and a window
 * open on the feed {@link target} — the first feed's id unless another is given.
 */
export function feedState(feeds: Feeds, target: string | null = feeds[0]?.id ?? null): AppState {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [A_ACCOUNT, B_ACCOUNT],
    activeKey: A_ACCOUNT.key,
  });
  const saved = coreReducer(signed, { type: 'settings', settings: { feeds } });
  return coreReducer(saved, {
    type: 'windows',
    action: { type: 'open', ref: feedRef(target), title: '~main' },
  });
}

/** The scrollback's lines as one string, oldest first: `id@account`, with client messages spelled out. */
export function readLines(buffer: Buffer): string {
  return buffer.lines
    .map((line) => {
      switch (line.kind) {
        case 'post':
          return `${line.status.id}@${line.accountKey ?? '-'}`;
        case 'notification':
          return `notification ${line.notification.id}@${line.accountKey ?? '-'}`;
        case 'system':
          return `system ${line.text}`;
      }
    })
    .join(' | ');
}
