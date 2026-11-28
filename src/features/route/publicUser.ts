/**
 * The two parts of opening a public link (WFE-340, decision 4) that talk to
 * the instance or to the user about it: the lookup of an account with no
 * token, by id or (WFE-342) by local handle, which opens her signed-out
 * profile window, and the warning that the build forced `publicView` on where
 * the instance restricts the read.
 */

import { getAccount, lookupAccount } from '../../api/endpoints/accountRead';
import { type ApiError, describeApiError } from '../../api/errors';
import type { Account } from '../../api/schemas/account';
import { t } from '../../i18n/translate';
import { hostOfOrigin } from '../../lib/origin';
import type { Result } from '../../lib/result';
import type { Route } from '../../lib/route';
import { anonKey, isRefusedAnon } from '../../state/anonAccount';
import { printAction } from '../../state/appState';
import { profileWindowOpen } from '../../state/profileWindow';
import type { Dispatch } from '../../state/StateContext';
import { STATUS_WINDOW_ID } from '../../windows/model';

/** Where a public profile is read from, and whether the build forced public view on against the instance. */
type Found = { readonly origin: string; readonly conflict: boolean };

/** The warning that the build forced `publicView` on where the instance says no. */
export function warnConflict(dispatch: Dispatch, origin: string): void {
  const text = t('features.route.public_view_conflict', { host: hostOfOrigin(origin) });
  dispatch(printAction(STATUS_WINDOW_ID, 'warn', text));
}

/**
 * Open the signed-out profile window of the account {@link read} answers on
 * {@link found}'s origin; false when the instance refuses the read (after
 * warning when the build forced it on), true otherwise, a failed lookup printed.
 */
async function openPublicProfile(
  read: Promise<Result<Account, ApiError>>,
  found: Found,
  dispatch: Dispatch,
): Promise<boolean> {
  const { origin, conflict } = found;
  const account = await read;
  if (account.ok) {
    dispatch({ type: 'windows', action: profileWindowOpen(account.value, anonKey(origin)) });
    return true;
  }
  if (!isRefusedAnon(account)) {
    dispatch(printAction(STATUS_WINDOW_ID, 'error', describeApiError(account.error)));
    return true;
  }
  if (conflict) {
    warnConflict(dispatch, origin);
  }
  return false;
}

/**
 * Open the profile window of the account {@link route} names by id on
 * {@link found}'s origin, read signed out; see {@link openPublicProfile}.
 */
export async function openPublicUser(
  route: Route,
  found: Found,
  dispatch: Dispatch,
): Promise<boolean> {
  const read = getAccount({ origin: found.origin, token: null }, route.value);
  return await openPublicProfile(read, found, dispatch);
}

/**
 * Open the profile window of the local account {@link route} names by handle
 * (`#/@nick`) on {@link found}'s origin, read signed out through the plain
 * lookup, which never searches; see {@link openPublicProfile}.
 */
export async function openPublicAcct(
  route: Route,
  found: Found,
  dispatch: Dispatch,
): Promise<boolean> {
  const read = lookupAccount({ origin: found.origin, token: null }, route.value);
  return await openPublicProfile(read, found, dispatch);
}
