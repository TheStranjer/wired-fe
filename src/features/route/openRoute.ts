/**
 * Opening a hash route's window (decision 4, AGENTS.md "Windows, like IRC
 * buffers"): {@link openRoute} maps one parsed route onto the window actions
 * the commands already use, for one account. A notice opens that post's
 * thread window, a tag its hashtag window (lowercased, as `/tag` does, so the
 * same tag is the same window), and an account — by name through
 * `findAccountByHandle`, by id through `getAccount` — its profile window. A lookup
 * that fails prints why into the status window instead, and opens nothing. A
 * remote follow or interaction link is searched for by ./openInteraction and
 * opens the account or post it finds.
 */

import { findInteraction } from './openInteraction';
import { findAccountByHandle, getAccount } from '../../api/endpoints/accountRead';
import { type ApiError, describeApiError } from '../../api/errors';
import type { Account } from '../../api/schemas/account';
import type { ApiSession } from '../../api/session';
import { t } from '../../i18n/translate';
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

/** Open the profile window of {@link account}. */
function openAccount(target: RouteTarget, account: Account): void {
  target.dispatch({ type: 'windows', action: profileWindowOpen(account, target.accountKey) });
}

/** Open the profile of the account {@link found} answers, or print why there is none. */
function openProfile(target: RouteTarget, found: Result<Account, ApiError>): void {
  if (found.ok) {
    openAccount(target, found.value);
  } else {
    target.dispatch(printAction(STATUS_WINDOW_ID, 'error', describeApiError(found.error)));
  }
}

/**
 * Open what a remote follow or interaction link to {@link value} names: an
 * account's profile window with the `/follow` hint printed into it, a post's
 * thread window, or a line saying nothing was found (a failed search finds
 * nothing).
 */
async function openInteraction(target: RouteTarget, value: string): Promise<void> {
  const found = await findInteraction(target.session, value);
  if (found === undefined) {
    target.dispatch(printAction(null, 'info', t('features.route.not_found', { value })));
  } else if ('acct' in found) {
    openAccount(target, found);
    const hint = t('features.route.follow_hint', { acct: found.acct });
    target.dispatch(printAction(null, 'info', hint));
  } else {
    await openRoute({ kind: 'notice', value: found.id }, target);
  }
}

/** Open the window {@link route} names for {@link target}'s account. */
export async function openRoute(route: Route, target: RouteTarget): Promise<void> {
  const { kind, value } = route;
  if (kind === 'notice') {
    open(target, { kind: 'thread', target: value }, `thread/${value}`);
  } else if (kind === 'tag') {
    const tag = value.toLowerCase();
    open(target, { kind: 'hashtag', target: tag }, `#${tag}`);
  } else if (kind === 'interact') {
    await openInteraction(target, value);
  } else {
    const read = kind === 'acct' ? findAccountByHandle : getAccount;
    openProfile(target, await read(target.session, value));
  }
}
