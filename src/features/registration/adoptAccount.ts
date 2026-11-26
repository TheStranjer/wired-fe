/**
 * Taking a freshly registered account into the running session: the account
 * store already holds it (and has made it active), so this tells the app state
 * about it, lets the app state find the account its place (the first sign-in
 * makes and opens the `stream` feed, a later one joins it or opens its own home
 * and notifications windows — src/state/signIn), says so in the status window
 * and reads what its instance turned out to be (decision 5) — what startup does
 * for every stored account, done for the one that just arrived.
 */

import type { AccountStore, StoredAccount } from '../../accounts/accountStore';
import { type ApiError, type InstanceProfile, describeApiError } from '../../capabilities/detect';
import { t } from '../../i18n/translate';
import type { Result } from '../../lib/result';
import { printAction } from '../../state/appState';
import type { Dispatch } from '../../state/StateContext';
import { STATUS_WINDOW_ID } from '../../windows/model';

/** What adopting needs: where to tell the app state, the stored accounts, and how to read an instance. */
export type AdoptEnv = {
  readonly dispatch: Dispatch;
  readonly accounts: AccountStore;
  readonly detect: (origin: string) => Promise<Result<InstanceProfile, ApiError>>;
};

/** Sign {@link account} in to the session: its place on the desk, its status line and its instance's profile. */
export async function adoptAccount(account: StoredAccount, env: AdoptEnv): Promise<void> {
  const { dispatch } = env;
  dispatch({ type: 'accounts', accounts: env.accounts.list(), activeKey: account.key });
  dispatch({ type: 'signedIn', account, date: new Date() });
  const loggedIn = t('features.registration.logged_in', {
    origin: account.origin,
    handle: account.handle,
  });
  dispatch(printAction(STATUS_WINDOW_ID, 'info', loggedIn));
  const detected = await env.detect(account.origin);
  if (detected.ok) {
    dispatch({ type: 'profile', profile: detected.value });
    return;
  }
  const reason = describeApiError(detected.error);
  const unreachable = t('features.registration.unreachable', { origin: account.origin, reason });
  dispatch(printAction(STATUS_WINDOW_ID, 'error', unreachable));
}
