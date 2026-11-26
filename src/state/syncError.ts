/**
 * What the desk sync says when the settings store refuses or cannot be
 * reached (decision 17). The texts name the problem and nothing else: no
 * token, no snapshot contents, and for a plain API failure only what
 * {@link describeApiError} already shows.
 */
import type { SettingsStoreError } from '../api/endpoints/settingsStore';
import { describeApiError } from '../api/errors';
import { t } from '../i18n/translate';

/** The warning for a server copy that does not read as a desk. */
export function invalidRemoteText(): string {
  return t('state.sync_invalid_remote');
}

/** The warning for a desk that went to the server without {@link dropped} (the phrases of `fitSnapshot`); this device keeps everything. */
export function describeTrimmed(dropped: readonly string[]): string {
  return t('state.sync_trimmed', { dropped: dropped.join(', ') });
}

/** The one line that says why {@link error} stopped the sync. */
export function describeSyncError(error: SettingsStoreError): string {
  if (error.kind === 'tooLarge') {
    return t('state.sync_too_large');
  }
  if (error.kind === 'forbidden') {
    return t('state.sync_forbidden');
  }
  if (error.kind === 'unsupported') {
    return t('state.sync_unsupported');
  }
  return t('state.sync_failed', { reason: describeApiError(error) });
}
