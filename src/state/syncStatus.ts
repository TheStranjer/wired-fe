/**
 * What the desk sync (decision 17) knows about itself, as part of the app
 * state so the status line and `/sync` can show it: whether a push is waiting,
 * whether the last attempt failed, when the last pull and push happened and
 * the last error's text. Never holds a token or any of the synced desk.
 */
import { putProfile } from './appReducer';
import type { AppState } from './appState';

/** What the sync engine reports about itself. */
export type SyncStatus = {
  /** A push is waiting for its delay, or on its way. */
  readonly pending: boolean;
  /** The last push or pull failed (and nothing has worked since). */
  readonly failed: boolean;
  /** When the last pull answered, ms since the epoch; null before one did. */
  readonly lastPull: number | null;
  /** When the last push was stored, ms since the epoch; null before one was. */
  readonly lastPush: number | null;
  /** The text of the last error, kept after it has been reported. */
  readonly lastError: string | null;
};

/** A session that has not synced yet. */
export const INITIAL_SYNC: SyncStatus = {
  pending: false,
  failed: false,
  lastPull: null,
  lastPush: null,
  lastError: null,
};

/** Which request the commands make of the engine: pull from the primary, or pull then push. */
export type SyncRequest = 'pull' | 'now';

/** What can happen to the sync status: some of it changes, or an instance turns out to have no settings store. */
export type SyncAction =
  | { readonly type: 'sync'; readonly status: Partial<SyncStatus> }
  | { readonly type: 'syncUnsupported'; readonly origin: string };

/** {@link state} with its instance profile for {@link origin} stripped of the settings store; unchanged when it has none. */
function withoutSettingsStore(state: AppState, origin: string): AppState {
  const profile = state.profiles.get(origin);
  if (profile === undefined) {
    return state;
  }
  const features = new Set(profile.capabilities.features);
  features.delete('settingsStore');
  const capabilities = { ...profile.capabilities, features };
  return { ...state, profiles: putProfile(state.profiles, { ...profile, capabilities }) };
}

/** Move the sync status along by one action. */
export function syncReducer(state: AppState, action: SyncAction): AppState {
  if (action.type === 'syncUnsupported') {
    return withoutSettingsStore(state, action.origin);
  }
  return { ...state, sync: { ...state.sync, ...action.status } };
}
