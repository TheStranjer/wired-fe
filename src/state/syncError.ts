/**
 * What the desk sync says when the settings store refuses or cannot be
 * reached (decision 17). The texts name the problem and nothing else: no
 * token, no snapshot contents, and for a plain API failure only what
 * {@link describeApiError} already shows.
 */
import type { SettingsStoreError } from '../api/endpoints/settingsStore';
import { describeApiError } from '../api/errors';

/** The warning for a server copy that does not read as a desk. */
export const INVALID_REMOTE_TEXT =
  'Sync: the desk saved on the server is not readable and was ignored; this one is kept';

/** The one line that says why {@link error} stopped the sync. */
export function describeSyncError(error: SettingsStoreError): string {
  if (error.kind === 'tooLarge') {
    return 'Sync: the server says the desk is too large to store';
  }
  if (error.kind === 'forbidden') {
    return 'Sync: this login may not use the settings store. Log in again to grant access';
  }
  if (error.kind === 'unsupported') {
    return 'Sync: the server has no settings store; syncing stopped';
  }
  return `Sync failed. ${describeApiError(error)}`;
}
