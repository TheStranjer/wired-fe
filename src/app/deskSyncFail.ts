/**
 * What the desk sync does when an account's settings store refuses or cannot
 * be reached (decision 17): quiet for a missing store, whose capability is
 * dropped; otherwise one warning per kind, the status line marked and the
 * text kept for `/sync`. Never holds a token or any of the desk.
 */
import { type SyncDeps, report, warnOnce } from './deskSyncKit';
import type { StoredAccount } from '../accounts/accountStore';
import { forgetIfUnsupported } from '../capabilities/forgetIfUnsupported';
import type { SettingsStoreError } from '../features/sync/settingsAccess';
import { describeSyncError } from '../state/syncError';

/** Handles a refusal of {@link account}'s server: quiet for a missing store, a warning once per kind otherwise. */
export function fail(deps: SyncDeps, account: StoredAccount, error: SettingsStoreError): void {
  const text = describeSyncError(error);
  if (error.kind === 'unsupported') {
    forgetIfUnsupported(deps.profiles, account.origin, error);
    deps.dispatch({ type: 'syncUnsupported', origin: account.origin });
    report(deps, { failed: false, lastError: text });
    return;
  }
  warnOnce(deps, error.kind, text);
  report(deps, { failed: true, lastError: text });
}
