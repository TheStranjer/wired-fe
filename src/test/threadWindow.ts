/**
 * The signed-in thread window the thread tests share (AGENTS.md "Testing"):
 * lain's account and one `thread` window targeted at post five, built through
 * the real reducers so a hook or a kind sees exactly what the app would have
 * shown it, plus the five-post conversation — two ancestors, the target, two
 * replies, oldest first — that {@link serveThread} answers `getStatus` and
 * `getContext` with over MSW. No handler answers what a test never served.
 */
import { HttpResponse, http } from 'msw';

import { status } from './fixtures';
import { server } from './server';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import type { ApiSession } from '../api/session';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import type { WindowRef } from '../windows/model';
import { windowId } from '../windows/model';

/** The instance a thread test signs in to and is answered by. */
export const ORIGIN = 'https://wired.example';

/** lain: the account the thread window belongs to and fetches with. */
export const THREAD_ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
};

/** Post five's thread window, its id, and the id of the same ref without a target. */
export const THREAD_REF: WindowRef = {
  kind: 'thread',
  accountKey: THREAD_ACCOUNT.key,
  target: '5',
};
export const THREAD_WINDOW = windowId(THREAD_REF);
export const THREAD_NO_TARGET = windowId({ ...THREAD_REF, target: null });

/** The session every served fetch arrives through. */
export const THREAD_SESSION: ApiSession = { origin: ORIGIN, token: 'never-logged' };

/** The conversation, oldest first: two above, the target, two below. */
export const FIRST_UP = status('3', { content: '<p>first up</p>' });
export const SECOND_UP = status('4', { content: '<p>second up</p>' });
export const THREAD_TARGET = status('5', { content: '<p>the fourth wall</p>' });
export const FIRST_DOWN = status('6', { content: '<p>first down</p>' });
export const SECOND_DOWN = status('7', { content: '<p>second down</p>' });

/** Serve target five and its conversation; either half may refuse. */
export function serveThread(failures: { status?: boolean; context?: boolean } = {}): void {
  server.use(
    http.get(`${ORIGIN}/api/v1/statuses/5`, () => {
      return failures.status === true
        ? HttpResponse.json({ error: 'Record not found' }, { status: 404 })
        : HttpResponse.json(THREAD_TARGET);
    }),
    http.get(`${ORIGIN}/api/v1/statuses/5/context`, () => {
      return failures.context === true
        ? HttpResponse.json({ error: 'Boom' }, { status: 500 })
        : HttpResponse.json({
            ancestors: [FIRST_UP, SECOND_UP],
            descendants: [FIRST_DOWN, SECOND_DOWN],
          });
    }),
  );
}

/** The signed-in state with the thread window open; {@link loaded} pre-loads it. */
export function threadState(loaded = false): AppState {
  const withWindow = coreReducer(
    coreReducer(initialAppState(), {
      type: 'accounts',
      accounts: [THREAD_ACCOUNT],
      activeKey: THREAD_ACCOUNT.key,
    }),
    { type: 'windows', action: { type: 'open', ref: THREAD_REF, title: 'thread/a2' } },
  );
  return loaded
    ? appReducer(withWindow, { type: 'load', windowId: THREAD_WINDOW, load: 'loaded' })
    : withWindow;
}

/** {@link state} signed out again: its windows stay, no account answers for them. */
export function unsigned(state: AppState): AppState {
  return coreReducer(state, { type: 'accounts', accounts: [], activeKey: null });
}

/** A second thread window over {@link state}, this one with nothing to target. */
export function withTargetless(state: AppState): AppState {
  return coreReducer(state, {
    type: 'windows',
    action: { type: 'open', ref: { ...THREAD_REF, target: null }, title: 'thread/-' },
  });
}
