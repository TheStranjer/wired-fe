/**
 * Sessions signed in on an instance whose capabilities were detected (WFE-172):
 * the actions that leave one account active, for tests of what a backend does
 * and does not offer. The capabilities themselves come from
 * src/capabilities/testCapabilities.
 */
import type { StoredAccount } from '../accounts/accountStore';
import type { AppState } from '../state/appState';
import type { AppAction } from '../state/reducer';

/** What a detected instance can do, as the app state stores it. */
type Detected =
  AppState['profiles'] extends ReadonlyMap<string, infer P>
    ? P extends { readonly capabilities: infer C }
      ? C
      : never
    : never;

/** The account on {@link origin} named {@link handle}, keyed as the account store keys it. */
export function accountOn(origin: string, handle: string): StoredAccount {
  return {
    key: `${origin}#${handle}`,
    origin,
    accountId: handle,
    handle,
    token: 'token',
    refreshToken: null,
    expiresAt: null,
  };
}

/** The actions that sign {@link account} in as the active one, its instance detected as {@link capabilities}. */
export function signedInOn(
  account: StoredAccount,
  capabilities: Detected | null,
): readonly AppAction[] {
  const accounts: AppAction = { type: 'accounts', accounts: [account], activeKey: account.key };
  if (capabilities === null) {
    return [accounts];
  }
  const profile = { origin: account.origin, title: 'Test', capabilities };
  return [accounts, { type: 'profile', profile }];
}
