/**
 * Taking a freshly registered account into the running session: the account
 * store already holds it (and has made it active), so this tells the app state
 * about it, opens its home and notifications windows, says so in the status
 * window and reads what its instance turned out to be (decision 5) — what
 * startup does for every stored account, done for the one that just arrived.
 */

import type { AccountStore, StoredAccount } from '../../accounts/accountStore';
import { type ApiError, type InstanceProfile, describeApiError } from '../../capabilities/detect';
import type { Result } from '../../lib/result';
import { printAction } from '../../state/appState';
import { openStartupWindows } from '../../state/startupWindows';
import type { Dispatch } from '../../state/StateContext';
import { STATUS_WINDOW_ID } from '../../windows/model';

/** What adopting needs: where to tell the app state, the stored accounts, and how to read an instance. */
export type AdoptEnv = {
  readonly dispatch: Dispatch;
  readonly accounts: AccountStore;
  readonly detect: (origin: string) => Promise<Result<InstanceProfile, ApiError>>;
};

/** Sign {@link account} in to the session: its windows, its status line and its instance's profile. */
export async function adoptAccount(account: StoredAccount, env: AdoptEnv): Promise<void> {
  const { dispatch } = env;
  dispatch({ type: 'accounts', accounts: env.accounts.list(), activeKey: account.key });
  for (const action of openStartupWindows([account], account.key)) {
    dispatch({ type: 'windows', action });
  }
  dispatch(
    printAction(STATUS_WINDOW_ID, 'info', `Logged in to ${account.origin} as @${account.handle}`),
  );
  const detected = await env.detect(account.origin);
  if (detected.ok) {
    dispatch({ type: 'profile', profile: detected.value });
    return;
  }
  const reason = describeApiError(detected.error);
  dispatch(printAction(STATUS_WINDOW_ID, 'error', `Could not reach ${account.origin}: ${reason}`));
}
