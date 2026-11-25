/**
 * The 404/501 rule of decision 5 for the settings store: an instance that
 * advertised `settingsStore` but answers its endpoint with `unsupported` has
 * the capability wrong, so its cached profile is dropped and the next load
 * detects it afresh.
 */
import { type ProfileStorage, forgetProfile } from './profileCache';
import type { SettingsStoreError } from '../api/endpoints/settingsStore';

/**
 * Drops {@link origin}'s cached profile when {@link error} is `unsupported`;
 * answers whether it did. Any other error leaves the profile alone.
 */
export function forgetIfUnsupported(
  storage: ProfileStorage,
  origin: string,
  error: SettingsStoreError,
): boolean {
  if (error.kind !== 'unsupported') {
    return false;
  }
  forgetProfile(storage, origin);
  return true;
}
