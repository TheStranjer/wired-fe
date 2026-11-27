/**
 * The reserved account key of a signed-out window (decision 13, WFE-340): a
 * window a visitor with no account opened for a public link reads one instance
 * anonymously, under `anon:<origin>` where an account's own key would stand.
 * This module is the one place that knows the form. A key of it stands for a
 * session with no token, which is never refreshed, never signed out and never
 * streamed; its windows are not part of the desk (./deskSnapshot) and are
 * rebound to the account that signs in on the same origin ({@link rebindAnon}).
 */

import type { ApiError } from '../api/errors';
import type { ApiSession } from '../api/session';
import type { Result } from '../lib/result';
import type { WindowState, WindowsState } from '../windows/model';
import { withAccountKey } from '../windows/model';

/** What every signed-out key starts with. */
const PREFIX = 'anon:';

/** The signed-out account key of {@link origin}. */
export function anonKey(origin: string): string {
  return `${PREFIX}${origin}`;
}

/** The origin {@link key} reads, or null when it is not a signed-out key. */
export function anonOrigin(key: string | null): string | null {
  return key?.startsWith(PREFIX) === true ? key.slice(PREFIX.length) : null;
}

/** Whether {@link key} is a signed-out key. */
export function isAnonKey(key: string | null): boolean {
  return anonOrigin(key) !== null;
}

/** The session of the signed-out {@link key}: its origin and no token; null for any other key. */
export function anonSession(key: string | null): ApiSession | null {
  const origin = anonOrigin(key);
  return origin === null ? null : { origin, token: null };
}

/** Whether the instance refused to show a signed-out read at all: a 401 or a 403. */
export function isRefusedAnon(result: Result<unknown, ApiError>): boolean {
  return (
    !result.ok &&
    result.error.kind === 'http' &&
    (result.error.status === 401 || result.error.status === 403)
  );
}

/** Whether {@link win} reads anonymously. */
export function isAnonWindow(win: WindowState): boolean {
  return isAnonKey(win.ref.accountKey);
}

/**
 * {@link windows} with every signed-out window of {@link origin} rebound to
 * the account {@link accountKey}, which has just signed in there: the windows
 * keep their ids and places and become normal ones.
 */
export function rebindAnon(
  windows: WindowsState,
  origin: string,
  accountKey: string,
): WindowsState {
  return windows.windows
    .filter((win) => win.ref.accountKey === anonKey(origin))
    .reduce((rest, win) => withAccountKey(rest, win.id, accountKey), windows);
}
