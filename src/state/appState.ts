/**
 * The whole application as one immutable value, and the reducer that moves it
 * (AGENTS.md "Layout": src/state is the pure app state — windows, line buffers,
 * accounts, settings — which the React context then puts in front of the shell).
 * The window list and its scrollbacks, the signed-in accounts and what their
 * instances turned out to be, the keyboard's mode and the reader's settings, all
 * in one place so a command, a hotkey and a click can ask for one transition.
 *
 * Every case returns the state it was handed when the action changes nothing —
 * an unknown window id, a mode already in, a stale active account — and the
 * pieces of a transition live in ./appReducer next door.
 */

import {
  isBlank,
  knownActiveKey,
  mergedSettings,
  printTarget,
  putBuffer,
  putProfile,
  sameAccounts,
  syncBuffers,
} from './appReducer';
import { type Buffer, EMPTY_BUFFER, appendSystem, clearBuffer, type LineLevel } from './buffer';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import type { StoredAccount } from '../accounts/accountStore';
import type { InstanceProfile } from '../capabilities/detect';
import type { WindowsState } from '../windows/model';
import { initialWindowsState } from '../windows/model';
import { windowsReducer } from '../windows/reducer';
import type { WindowsAction } from '../windows/reducer';

/**
 * Which mode the keyboard is in: typing into the command line, or single keys
 * acting. src/keys owns the same union as `InputMode`; this layer may not
 * import it, so the state names its own and src/app is where the two meet.
 */
export type InputModeState = 'insert' | 'navigation';

/** Everything the shell renders, as one value. */
export type AppState = {
  /** The numbered windows and which one is shown (src/windows). */
  readonly windows: WindowsState;
  /** One scrollback per window, by window id; always holds the status window's. */
  readonly buffers: ReadonlyMap<string, Buffer>;
  /** The signed-in accounts, in the order they were added. */
  readonly accounts: readonly StoredAccount[];
  /** The account commands act as; null while nobody is signed in. */
  readonly activeAccountKey: string | null;
  /** What each instance turned out to be, by origin (decision 5). */
  readonly profiles: ReadonlyMap<string, InstanceProfile>;
  readonly mode: InputModeState;
  readonly settings: Settings;
  /** The client-message counter: every printed line is keyed by its value. */
  readonly seq: number;
};

/** One thing that can happen to the application as a whole. */
export type CoreAction =
  | { readonly type: 'windows'; readonly action: WindowsAction }
  | {
      readonly type: 'print';
      /** The window to print in, or null for the active one; unknown means window 1. */
      readonly windowId: string | null;
      readonly date: Date;
      readonly level: LineLevel;
      readonly text: string;
      /** The line is decorative ASCII art (WFE-135): stored on the line so
       * the view can hide it from assistive technology. Omitted otherwise. */
      readonly decorative?: boolean;
    }
  | { readonly type: 'clear'; readonly windowId: string }
  | {
      readonly type: 'accounts';
      readonly accounts: readonly StoredAccount[];
      readonly activeKey: string | null;
    }
  | { readonly type: 'profile'; readonly profile: InstanceProfile }
  | { readonly type: 'mode'; readonly mode: InputModeState }
  | { readonly type: 'settings'; readonly settings: Partial<Settings> };

/** The print action, named so its fields can be passed around as one. */
export type PrintAction = Extract<CoreAction, { readonly type: 'print' }>;

/**
 * The action that prints one client line into a window's scrollback — the
 * active window for a null id — stamped with the real clock, at the given
 * level. (The startup path stamps itself: its clock is injected.)
 */
export function printAction(windowId: string | null, level: LineLevel, text: string): PrintAction {
  return { type: 'print', windowId, date: new Date(), level, text };
}

/**
 * The state a session starts in: window 1 with its empty buffer, nobody signed
 * in, the keyboard in insert mode, {@link DEFAULT_SETTINGS} unless the caller
 * has stored better ones.
 */
export function initialAppState(settings: Settings = DEFAULT_SETTINGS): AppState {
  const windows = initialWindowsState();
  return {
    windows,
    buffers: syncBuffers(windows.windows, new Map<string, Buffer>()),
    accounts: [],
    activeAccountKey: null,
    profiles: new Map<string, InstanceProfile>(),
    mode: 'insert',
    settings,
    seq: 0,
  };
}

/** Move the app state along by one action; the same state when nothing changes. */
export function coreReducer(state: AppState, action: CoreAction): AppState {
  switch (action.type) {
    case 'windows':
      return applyWindows(state, action.action);
    case 'print':
      return applyPrint(state, action);
    case 'clear':
      return applyClear(state, action.windowId);
    case 'accounts':
      return applyAccounts(state, action.accounts, action.activeKey);
    case 'profile':
      return applyProfile(state, action.profile);
    case 'mode':
      return applyMode(state, action.mode);
    case 'settings':
      return applySettings(state, action.settings);
  }
}

/** A window action, and the buffers brought back to the shape of the list. */
function applyWindows(state: AppState, action: WindowsAction): AppState {
  const windows = windowsReducer(state.windows, action);
  const buffers = syncBuffers(windows.windows, state.buffers);
  if (windows === state.windows && buffers === state.buffers) {
    return state;
  }
  return { ...state, windows, buffers };
}

/** One client message at the bottom of the window that takes it, keyed by `seq`. */
function applyPrint(state: AppState, action: PrintAction): AppState {
  const id = printTarget(state.windows, action.windowId);
  const { date, level, text, decorative } = action;
  const buffer = appendSystem(
    state.buffers.get(id) ?? EMPTY_BUFFER,
    { date, level, text, ...(decorative === true ? { decorative } : {}) },
    state.seq,
  );
  return { ...state, buffers: putBuffer(state.buffers, id, buffer), seq: state.seq + 1 };
}

/** Everything a window shows, wiped from its scrollback; `/clear` and Ctrl+L. */
function applyClear(state: AppState, windowId: string): AppState {
  const buffer = state.buffers.get(windowId);
  if (buffer === undefined || isBlank(buffer)) {
    return state;
  }
  return { ...state, buffers: putBuffer(state.buffers, windowId, clearBuffer(buffer)) };
}

/** The signed-in accounts and the active pointer, stale pointers dropped. */
function applyAccounts(
  state: AppState,
  accounts: readonly StoredAccount[],
  activeKey: string | null,
): AppState {
  const key = knownActiveKey(accounts, activeKey);
  if (key === state.activeAccountKey && sameAccounts(state.accounts, accounts)) {
    return state;
  }
  return { ...state, accounts, activeAccountKey: key };
}

/** What one instance turned out to be, stored under its origin. */
function applyProfile(state: AppState, profile: InstanceProfile): AppState {
  const profiles = putProfile(state.profiles, profile);
  if (profiles === state.profiles) {
    return state;
  }
  return { ...state, profiles };
}

/** The mode the keyboard is in. */
function applyMode(state: AppState, mode: InputModeState): AppState {
  return state.mode === mode ? state : { ...state, mode };
}

/** The reader's settings, with {@link patch} laid over them. */
function applySettings(state: AppState, patch: Partial<Settings>): AppState {
  const settings = mergedSettings(state.settings, patch);
  return settings === state.settings ? state : { ...state, settings };
}
