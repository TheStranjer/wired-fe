/**
 * The signed-in window list and the streaming frames the routing tests share
 * (AGENTS.md "Testing"): two accounts on one instance, mine the active one, and
 * an app state with any set of views opened through the real reducers — so the
 * code under test sees exactly the window list the shell would have shown, and
 * the hole a closed window leaves behind. {@link offscreen} keeps window 1 on
 * screen, which is what makes an arrival unread; {@link opened} puts the window
 * a test names there instead. {@link arriving} is one update frame, and
 * {@link deliveredTo} the action a window is asked to take it.
 */

import { TEST_DATE } from './fixtures';
import type { StoredAccount } from '../accounts/accountStore';
import type { Mention } from '../api/schemas/mention';
import type { Status } from '../api/schemas/status';
import type { StreamEvent } from '../api/streaming';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import type { BufferAction } from '../state/bufferActions';
import { STATUS_WINDOW_ID, type WindowRef, windowId } from '../windows/model';

/** The instance both accounts live on. */
export const ORIGIN = 'https://wired.example';

/** The key of the account a stream connection, and these events, belong to. */
export const MINE = `${ORIGIN}#me`;

/** The key of the other account, whose windows no event of mine should reach. */
export const THEIRS = `${ORIGIN}#them`;

/** The two stored accounts, mine the active one. */
const ACCOUNTS: readonly StoredAccount[] = [
  {
    key: MINE,
    origin: ORIGIN,
    accountId: 'me',
    handle: 'lain@wired.example',
    token: 'x',
    refreshToken: null,
    expiresAt: null,
  },
  {
    key: THEIRS,
    origin: ORIGIN,
    accountId: 'them',
    handle: 'ally@wired.example',
    token: 'x',
    refreshToken: null,
    expiresAt: null,
  },
];

/** The account every backend sends for somebody the wire reports as {@link acct}. */
export function wireActor(acct: string): Record<string, unknown> {
  return {
    id: `acct-${acct}`,
    username: acct.split('@')[0] ?? acct,
    acct,
    display_name: '',
    created_at: TEST_DATE,
    note: '',
    url: `${ORIGIN}/@${acct}`,
    avatar: '',
    header: '',
    followers_count: 0,
    following_count: 0,
    statuses_count: 0,
  };
}

/** The signed-in state with {@link views} open and {@link active} on screen. */
export function opened(views: readonly WindowRef[], active: string): AppState {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: ACCOUNTS,
    activeKey: MINE,
  });
  const shown = views.reduce(
    (state, view) =>
      coreReducer(state, {
        type: 'windows',
        action: { type: 'open', ref: view, title: view.kind },
      }),
    signed,
  );
  return coreReducer(shown, { type: 'windows', action: { type: 'activate', id: active } });
}

/** The signed-in state with {@link views} open and window 1 on screen. */
export function offscreen(...views: readonly WindowRef[]): AppState {
  return opened(views, STATUS_WINDOW_ID);
}

/** {@link state} with {@link view} closed: no window, no buffer, no arrival. */
export function closed(state: AppState, view: WindowRef): AppState {
  return coreReducer(state, { type: 'windows', action: { type: 'close', id: windowId(view) } });
}

/** A new post {@link shown} arriving on {@link streams}, on the tested account's connection. */
export function arriving(streams: readonly string[], shown: Status): StreamEvent {
  return { kind: 'update', stream: streams, status: shown };
}

/** The @-mention a backend resolved to {@link acct}, bare or with its host. */
export function mentioning(acct: string): Mention {
  const [username = acct] = acct.split('@');
  return { id: `mention-${acct}`, username, acct, url: `${ORIGIN}/@${acct}` };
}

/** The action that asks the window {@link view} to grow by {@link shown}. */
export function deliveredTo(view: WindowRef, shown: Status): StatusesAction {
  return { type: 'statuses', windowId: windowId(view), statuses: [shown], where: 'newer' };
}

/** The statuses action {@link deliveredTo} builds, in the shape the reducer owns. */
type StatusesAction = Extract<BufferAction, { readonly type: 'statuses' }>;
