/**
 * The two parts of opening a public link (WFE-340, decision 4) that talk to
 * the instance or to the user about it: the lookup of an account with no
 * token, which opens her signed-out profile window, and the warning that the
 * build forced `publicView` on where the instance restricts the read.
 */

import { getAccount } from '../../api/endpoints/accountRead';
import { describeApiError } from '../../api/errors';
import { t } from '../../i18n/translate';
import { hostOfOrigin } from '../../lib/origin';
import type { Route } from '../../lib/route';
import { anonKey, isRefusedAnon } from '../../state/anonAccount';
import { printAction } from '../../state/appState';
import { profileWindowOpen } from '../../state/profileWindow';
import type { Dispatch } from '../../state/StateContext';
import { STATUS_WINDOW_ID } from '../../windows/model';

/** The warning that the build forced `publicView` on where the instance says no. */
export function warnConflict(dispatch: Dispatch, origin: string): void {
  const text = t('features.route.public_view_conflict', { host: hostOfOrigin(origin) });
  dispatch(printAction(STATUS_WINDOW_ID, 'warn', text));
}

/**
 * Open the profile window of the account {@link route} names on {@link origin},
 * read signed out; false when the instance refuses the read (after warning
 * when {@link conflict}: the build forced it on), true otherwise, a failed
 * lookup printed.
 */
export async function openPublicUser(
  route: Route,
  found: { readonly origin: string; readonly conflict: boolean },
  dispatch: Dispatch,
): Promise<boolean> {
  const { origin, conflict } = found;
  const account = await getAccount({ origin, token: null }, route.value);
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
