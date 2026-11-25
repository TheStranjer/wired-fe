/**
 * The scaffolding the desk sync tests share (AGENTS.md "Testing"): the built
 * desk with Lain on `a.example` (a Wired with the settings store) and Bob on
 * `b.example` (a Mastodon without it, or a second Wired), a dispatch that
 * runs the real reducer and records every action, a desk source over a memory
 * backend, a profile cache and a clock the tests set. Test wiring only; no
 * assertion lives here.
 */
import { BOB, LAIN, builtDesk } from './deskFixtures';
import { memoryBackend } from './memoryBackend';
import type { SyncPrefs } from '../accounts/syncPrefs';
import type { DeviceClass } from '../lib/deviceClass';
import type { AppState } from '../state/appState';
import { toSyncSnapshot } from '../state/deskSync';
import { type AppAction, appReducer } from '../state/reducer';
import { createStore } from '../storage/store';
import type { Store } from '../storage/store';

/** The instance profile an action carries. */
type Profile = Extract<AppAction, { readonly type: 'profile' }>['profile'];

/** What a test chooses about the world the sync runs in. */
export type SyncWorldOptions = {
  /** Whether Bob's instance has the settings store too. */
  readonly bobStore?: boolean;
  /** Whether Lain's instance has the settings store. */
  readonly lainStore?: boolean;
  readonly prefs?: SyncPrefs;
};

/** A detected instance with or without the settings store. */
function profileOf(origin: string, store: boolean): Profile {
  return {
    origin,
    title: origin,
    capabilities: {
      backend: store ? 'wired' : 'mastodon',
      maxCharacters: 500,
      maxMediaAttachments: 4,
      pollLimits: {
        maxOptions: 4,
        maxCharactersPerOption: 50,
        minExpiration: 300,
        maxExpiration: 2629746,
      },
      features: new Set(store ? (['settingsStore'] as const) : []),
    },
  };
}

/** The built desk with both instances detected as {@link options} say. */
function detectedDesk(options: SyncWorldOptions): AppState {
  const lain = profileOf(LAIN.origin, options.lainStore ?? true);
  const bob = profileOf(BOB.origin, options.bobStore ?? false);
  return [lain, bob].reduce(
    (state, profile) => appReducer(state, { type: 'profile', profile }),
    builtDesk(),
  );
}

/** The world a sync runs in, and everything it did to it. */
export type SyncHarness = {
  readonly io: {
    readonly getState: () => AppState;
    readonly dispatch: (action: AppAction) => void;
    readonly prefs: () => SyncPrefs;
    readonly source: { readonly store: Store; readonly deviceClass: DeviceClass };
    readonly profiles: Store;
    readonly now: () => number;
  };
  /** Every action dispatched, in order. */
  readonly actions: AppAction[];
  readonly state: () => AppState;
  /** Moves the state along as a reader's own change would. */
  readonly change: (action: AppAction) => void;
  readonly setPrefs: (prefs: SyncPrefs) => void;
  /** Sets what the clock reads. */
  readonly setTime: (ms: number) => void;
};

/** A fresh world: {@link options} say which instances have the settings store and what the reader chose. */
export function syncHarness(options: SyncWorldOptions = {}): SyncHarness {
  let current = detectedDesk(options);
  let prefs: SyncPrefs = options.prefs ?? { syncAccounts: [], syncEnabled: true };
  let time = 1_000_000;
  const actions: AppAction[] = [];
  const dispatch = (action: AppAction): void => {
    actions.push(action);
    current = appReducer(current, action);
  };
  return {
    io: {
      getState: () => current,
      dispatch,
      prefs: () => prefs,
      source: { store: createStore('desk', memoryBackend()), deviceClass: 'desktop' },
      profiles: createStore('profiles', memoryBackend()),
      now: () => time,
    },
    actions,
    state: () => current,
    change: (action) => {
      current = appReducer(current, action);
    },
    setPrefs: (next) => {
      prefs = next;
    },
    setTime: (ms) => {
      time = ms;
    },
  };
}

/** The texts printed into the status window, in order. */
export function printed(harness: SyncHarness): readonly string[] {
  return harness.actions.flatMap((action) => (action.type === 'print' ? [action.text] : []));
}

/** The snapshot of {@link state} stamped {@link updatedAt}, as the server hands it back: through JSON. */
export function served(state: AppState, updatedAt: number): unknown {
  return JSON.parse(JSON.stringify(toSyncSnapshot(state, updatedAt)));
}
