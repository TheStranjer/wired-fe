/**
 * The scaffolding the hash router's tests share (AGENTS.md "Testing"): lain
 * signed in on `https://wired.example`, ally as the instance sends her, a
 * router hook mounted over a seeded app state with the state and dispatch it
 * acts through, and the little readers of that state and of the address bar.
 * Test wiring only; no assertion lives here.
 */
import { type RenderHookResult, renderHook } from '@testing-library/react';

import { seeded } from './appSessions';
import { type StoredAccount, accountKey } from '../accounts/accountStore';
import type { AppState } from '../state/appState';
import type { AppAction } from '../state/reducer';
import { bufferFor } from '../state/selectors';
import { type Dispatch, useAppDispatch, useAppState } from '../state/StateContext';
import { STATUS_WINDOW_ID } from '../windows/model';

/** The instance the router's tests sign in to and are answered by. */
export const ORIGIN = 'https://wired.example';

/** lain, signed in and active. */
export const LAIN: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
};

/** Ally's account as the instance sends it. */
export const ALLY = {
  id: '55',
  username: 'ally',
  acct: 'ally@x.example',
  display_name: 'Ally',
  created_at: '2024-03-01T00:00:00.000Z',
  note: '<p>hi</p>',
  url: 'https://x.example/users/ally',
  avatar: `${ORIGIN}/avi.png`,
  header: `${ORIGIN}/banner.png`,
  followers_count: 1,
  following_count: 2,
  statuses_count: 3,
};

/** The actions that sign lain in. */
const SIGN_IN: readonly AppAction[] = [{ type: 'accounts', accounts: [LAIN], activeKey: LAIN.key }];

/** What a mounted router hands the test: the app state and the dispatch it acts through. */
type Mounted = RenderHookResult<
  { readonly state: AppState; readonly dispatch: Dispatch },
  { readonly ready: boolean }
>;

/** {@link useRoute} mounted, {@link ready} or not, over the state {@link actions} lead to. */
export function mountRouter(
  useRoute: (ready: boolean) => void,
  ready: boolean,
  actions: readonly AppAction[] = SIGN_IN,
): Mounted {
  return renderHook(
    ({ ready: isReady }: { readonly ready: boolean }) => {
      useRoute(isReady);
      return { state: useAppState(), dispatch: useAppDispatch() };
    },
    { wrapper: seeded(actions), initialProps: { ready } },
  );
}

/** Points the address bar at {@link url}. */
export function visit(url: string): void {
  window.history.replaceState(null, '', url);
}

/** The titles of the windows, in order. */
export function titles(state: AppState): readonly string[] {
  return state.windows.windows.map((win) => win.title);
}

/** The texts printed into the status window. */
export function statusLines(state: AppState): readonly string[] {
  return bufferFor(state, STATUS_WINDOW_ID).lines.flatMap((line) =>
    line.kind === 'system' ? [line.text] : [],
  );
}
