/**
 * The buffer sessions the completion providers' tests share (WFE-124): one
 * real-reducer AppState whose single home window shows given statuses and
 * notifications beside a client message — which no provider may offer — plus
 * the account, mention and tag wire objects the entity fixtures stamp posts
 * with. Building through the reducer means a provider sees exactly the
 * buffers the shell would have shown.
 */

import { TEST_DATE } from './fixtures';
import type { StoredAccount } from '../accounts/accountStore';
import type { Notification } from '../api/schemas/notification';
import type { Status } from '../api/schemas/status';
import { type AppState, initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { type WindowRef, windowId } from '../windows/model';

/** The signed-in account whose handle a provider must also offer. */
export const ACCOUNT: StoredAccount = {
  key: 'https://wired.example#1',
  origin: 'https://wired.example',
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'not-a-real-token',
  refreshToken: null,
  expiresAt: null,
};

/** The one home window the test session shows. */
const REF: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };

/** What one test session's home window shows. */
export type Session = {
  readonly statuses?: readonly Status[];
  readonly notifications?: readonly Notification[];
  readonly accounts?: readonly StoredAccount[];
};

/** The real reducer's session: one home window showing the given lines. */
export function sessionWith(items: Session = {}): AppState {
  const opened = appReducer(initialAppState(), {
    type: 'windows',
    action: { type: 'open', ref: REF, title: 'home' },
  });
  const spoken = appReducer(opened, {
    type: 'print',
    windowId: windowId(REF),
    date: new Date(TEST_DATE),
    level: 'info',
    text: 'a client message no provider offers',
  });
  const shown = appReducer(spoken, {
    type: 'statuses',
    windowId: windowId(REF),
    statuses: items.statuses ?? [],
    where: 'newer',
  });
  const notified = appReducer(shown, {
    type: 'notifications',
    windowId: windowId(REF),
    notifications: items.notifications ?? [],
    where: 'newer',
  });
  return appReducer(notified, {
    type: 'accounts',
    accounts: items.accounts ?? [],
    activeKey: null,
  });
}

/** An account wire object named {@link acct}: the schema fills in the rest. */
export function author(acct: string): Record<string, unknown> {
  const username = acct.split('@')[0] ?? acct;
  return {
    id: `acct-${acct}`,
    username,
    acct,
    display_name: username,
    created_at: TEST_DATE,
    note: '',
    url: `https://remote.example/@${username}`,
    avatar: 'https://remote.example/a.png',
    header: 'https://remote.example/h.png',
    followers_count: 0,
    following_count: 0,
    statuses_count: 0,
  };
}

/** A mention of {@link acct}, as a status's `mentions` entry carries it. */
export function mention(acct: string): Record<string, unknown> {
  const username = acct.split('@')[0] ?? acct;
  return { id: `men-${acct}`, username, acct, url: `https://remote.example/@${username}` };
}

/** A tag named {@link name}, as a status's `tags` entry carries it. */
export function tag(name: string): Record<string, unknown> {
  return { name, url: `https://remote.example/tags/${name}` };
}
