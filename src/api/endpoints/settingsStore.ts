/**
 * The settings store endpoint (decision 17): `GET` and `PATCH`
 * `/api/v1/pleroma/settings/wired-fe` read and write the one JSON object the
 * server keeps for WiredFE on the account. Wired, Pleroma and Akkoma serve it.
 *
 * Merge semantics: the server **deep-merges** a PATCH body into what it stores
 * (Pleroma's `merge_recursively`, which WiredBE copies in
 * `src/api/pleroma_settings.rs`). Nested objects merge key by key, a `null`
 * value deletes a key, and anything else, arrays included, replaces. A
 * snapshot sent whole replaces the old one only when every collection inside
 * it is an array, never an object keyed by ids ({@link SettingsCollection}).
 * The answer to a PATCH is the merged object.
 *
 * Failures beyond {@link ApiError} are typed: 422 "too large" is `tooLarge`,
 * 403 (the token lacks the `read`/`write` scope) is `forbidden`, and 404 or
 * 501 is `unsupported`, after which the caller drops the `settingsStore`
 * capability (decision 5; see `forgetIfUnsupported` in src/capabilities).
 */
import { type Result, err } from '../../lib/result';
import type { ApiError } from '../errors';
import { type SettingsStore, SettingsStoreSchema } from '../schemas/settingsStore';
import { type ApiSession, sessionRequestData } from '../session';

/** Why a settings store call failed: a plain {@link ApiError} or one of the typed refusals. */
export type SettingsStoreError =
  | ApiError
  | { readonly kind: 'tooLarge' }
  | { readonly kind: 'forbidden' }
  | { readonly kind: 'unsupported' };

/** The one path both calls use. */
const PATH = '/api/v1/pleroma/settings/wired-fe';

/** Whether {@link message} is the server's "settings_store: too large" refusal. */
function isTooLarge(message: string): boolean {
  return message.toLowerCase().includes('too large');
}

/** {@link error} with the settings store's typed refusals told apart; others unchanged. */
function classify(error: ApiError): SettingsStoreError {
  if (error.kind !== 'http') {
    return error;
  }
  if (error.status === 404 || error.status === 501) {
    return { kind: 'unsupported' };
  }
  if (error.status === 403) {
    return { kind: 'forbidden' };
  }
  return error.status === 422 && isTooLarge(error.message) ? { kind: 'tooLarge' } : error;
}

/** {@link result} with a failure run through {@link classify}. */
function classified(
  result: Result<SettingsStore, ApiError>,
): Result<SettingsStore, SettingsStoreError> {
  return result.ok ? result : err(classify(result.error));
}

/** Reads the stored object of {@link session}'s account: `{}` when nothing was saved. */
export async function getSettingsStore(
  session: ApiSession,
): Promise<Result<SettingsStore, SettingsStoreError>> {
  return classified(await sessionRequestData(session, { path: PATH, schema: SettingsStoreSchema }));
}

/**
 * Merges {@link patch} into the stored object (see the merge semantics above)
 * and returns the merged object.
 */
export async function patchSettingsStore(
  session: ApiSession,
  patch: Readonly<Record<string, unknown>>,
): Promise<Result<SettingsStore, SettingsStoreError>> {
  return classified(
    await sessionRequestData(session, {
      path: PATH,
      method: 'PATCH',
      json: patch,
      schema: SettingsStoreSchema,
    }),
  );
}
