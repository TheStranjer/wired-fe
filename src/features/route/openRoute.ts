/**
 * Opening a hash route's window (decision 4, AGENTS.md "Windows, like IRC
 * buffers"): {@link openRoute} maps one parsed route onto the window actions
 * the commands already use, for one account. A notice opens that post's
 * thread window, a tag its hashtag window (lowercased, as `/tag` does, so the
 * same tag is the same window), and an account — by name through
 * `lookupAccount`, by id through `getAccount` — its profile window. A lookup
 * that fails prints why into the status window instead, and opens nothing.
 */

import { getAccount, lookupAccount } from '../../api/endpoints/accountRead';
import { type ApiError, describeApiError } from '../../api/errors';
import type { Account } from '../../api/schemas/account';
import type { ApiSession } from '../../api/session';
import type { Result } from '../../lib/result';
import type { Route } from '../../lib/route';
import { printAction } from '../../state/appState';
import { profileWindowOpen } from '../../state/profileWindow';
import type { Dispatch } from '../../state/StateContext';
import { STATUS_WINDOW_ID } from '../../windows/model';
import type { WindowRef } from '../../windows/model';

/** Who opens the route: the account's key and session, and where actions go. */
export type RouteTarget = {
  readonly accountKey: string;
  readonly session: ApiSession;
  readonly dispatch: Dispatch;
};

/** Open the window of {@link view} for {@link target}'s account, titled {@link title}. */
function open(target: RouteTarget, view: Pick<WindowRef, 'kind' | 'target'>, title: string): void {
  const ref = { ...view, accountKey: target.accountKey };
  target.dispatch({ type: 'windows', action: { type: 'open', ref, title } });
}

/** Open the profile of the account {@link found} answers, or print why there is none. */
function openProfile(target: RouteTarget, found: Result<Account, ApiError>): void {
  target.dispatch(
    found.ok
      ? { type: 'windows', action: profileWindowOpen(found.value, target.accountKey) }
      : printAction(STATUS_WINDOW_ID, 'error', describeApiError(found.error)),
  );
}

/** Open the window {@link route} names for {@link target}'s account. */
export async function openRoute(route: Route, target: RouteTarget): Promise<void> {
  const { kind, value } = route;
  if (kind === 'notice') {
    open(target, { kind: 'thread', target: value }, `thread/${value}`);
  } else if (kind === 'tag') {
    const tag = value.toLowerCase();
    open(target, { kind: 'hashtag', target: tag }, `#${tag}`);
  } else {
    const read = kind === 'acct' ? lookupAccount : getAccount;
    openProfile(target, await read(target.session, value));
  }
}
