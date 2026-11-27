/**
 * The whole application as one immutable value, and the reducer that moves it
 * (AGENTS.md "Layout": src/state is the pure app state). Windows and their
 * scrollbacks, the accounts, what their instances turned out to be, the
 * keyboard's mode and the settings sit in one place so a command, a hotkey and
 * a click ask for one transition. Every case returns the state it was handed
 * when the action changes nothing; the pieces live in ./appReducer.
 */

import { type AccountPick, withoutLonelyPick } from './accountPick';
import type { Alert } from './alerts';
import { withPrintedAlert } from './appPrint';
import type { PrintLine } from './appPrint';
import {
  clearedBuffers,
  mergedSettings,
  putProfile,
  replacing,
  syncBuffers,
  withAccounts,
  withExpired,
} from './appReducer';
import type { Buffer, LineLevel } from './buffer';
import type { ComposerFields, ComposerMedia } from './draft';
import { applyLayoutAction, applyWindowsAction } from './layoutSync';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import { dropSignedOut } from './signedOut';
import { INITIAL_SYNC, type SyncStatus } from './syncStatus';
import type { StoredAccount } from '../accounts/accountStore';
import type { InstanceProfile } from '../capabilities/detect';
import { initialDesktops } from '../windows/desktops';
import type { DesktopsState } from '../windows/desktops';
import type { LayoutAction } from '../windows/layoutAction';
import type { WindowsState } from '../windows/model';
import { STATUS_WINDOW_ID, initialWindowsState } from '../windows/model';
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
  /** The desktops: split trees of panes and floats, one active (src/windows). */
  readonly layout: DesktopsState;
  /** One scrollback per window, by window id; always holds the status window's. */
  readonly buffers: ReadonlyMap<string, Buffer>;
  /** The signed-in accounts, in order added. */
  readonly accounts: readonly StoredAccount[];
  /** The account commands act as; null while nobody is signed in. */
  readonly activeAccountKey: string | null;
  /** Keys of accounts whose token was refused and could not be refreshed. */
  readonly expired: ReadonlySet<string>;
  /** Signed-out keys refused a read, until answered (./anonRefusal). */
  readonly anonRefused: ReadonlySet<string>;
  /** What each instance turned out to be, by origin (decision 5). */
  readonly profiles: ReadonlyMap<string, InstanceProfile>;
  /** The pane composers' drafts, by window id (./composerActions). */
  readonly composers: ReadonlyMap<string, ComposerFields>;
  /** The pane composers' attachments, by window id (./composerMedia). */
  readonly composerMedia: ReadonlyMap<string, readonly ComposerMedia[]>;
  readonly mode: InputModeState;
  readonly settings: Settings;
  /** What the desk sync reports about itself (decision 17). */
  readonly sync: SyncStatus;
  /** The client-message counter: every printed line is keyed by its value. */
  readonly seq: number;
  /** The modal alerts the error lines raised, oldest first; the head is on screen (./alerts). */
  readonly alerts: readonly Alert[];
  /** The account picker's open question, or null. */
  readonly accountPick: AccountPick | null;
  /** Whether the start menu is open. */
  readonly startMenu: boolean;
  /** Whether the language list is open (WFE-310). */
  readonly languageMenu: boolean;
};

/** One thing that can happen to the application as a whole. */
export type CoreAction =
  | { readonly type: 'windows'; readonly action: WindowsAction }
  | { readonly type: 'layout'; readonly action: LayoutAction }
  | ({ readonly type: 'print' } & PrintLine)
  | { readonly type: 'clear'; readonly windowId: string }
  | {
      readonly type: 'accounts';
      readonly accounts: readonly StoredAccount[];
      readonly activeKey: string | null;
    }
  | { readonly type: 'accountExpired'; readonly accountKey: string }
  | { readonly type: 'profile'; readonly profile: InstanceProfile }
  | { readonly type: 'mode'; readonly mode: InputModeState }
  | { readonly type: 'settings'; readonly settings: Partial<Settings> };

/** The print action, named so its fields can be passed around as one. */
export type PrintAction = Extract<CoreAction, { readonly type: 'print' }>;

/** The action that prints a client line into a window (the active one for null), stamped now. */
export function printAction(windowId: string | null, level: LineLevel, text: string): PrintAction {
  return { type: 'print', windowId, date: new Date(), level, text };
}

/** The starting state: window 1, nobody signed in, insert mode, default settings. */
export function initialAppState(settings: Settings = DEFAULT_SETTINGS): AppState {
  const windows = initialWindowsState();
  return {
    windows,
    layout: initialDesktops(STATUS_WINDOW_ID),
    buffers: syncBuffers(windows.windows, new Map<string, Buffer>()),
    accounts: [],
    activeAccountKey: null,
    expired: new Set<string>(),
    anonRefused: new Set<string>(),
    profiles: new Map<string, InstanceProfile>(),
    composers: new Map<string, ComposerFields>(),
    composerMedia: new Map<string, readonly ComposerMedia[]>(),
    mode: 'insert',
    settings,
    sync: INITIAL_SYNC,
    seq: 0,
    alerts: [],
    accountPick: null,
    startMenu: false,
    languageMenu: false,
  };
}

/** Move the app state along by one action; the same state when nothing changes. */
export function coreReducer(state: AppState, action: CoreAction): AppState {
  switch (action.type) {
    case 'windows':
      return applyWindows(state, action.action);
    case 'layout':
      return applyLayout(state, action.action);
    case 'print':
      return withPrintedAlert(state, action);
    case 'clear':
      return applyClear(state, action.windowId);
    case 'accounts':
      return withoutLonelyPick(
        dropSignedOut(state, withAccounts(state, action.accounts, action.activeKey)),
      );
    case 'accountExpired':
      return { ...state, expired: withExpired(state.expired, action.accountKey) };
    case 'profile':
      return replacing(state, 'profiles', putProfile(state.profiles, action.profile));
    case 'mode':
      return applyMode(state, action.mode);
    case 'settings':
      return replacing(state, 'settings', mergedSettings(state.settings, action.settings));
  }
}

/** A window action, with the buffers brought back in line with the list. */
function applyWindows(state: AppState, action: WindowsAction): AppState {
  const { windows, layout } = applyWindowsAction(state, action);
  const buffers = syncBuffers(windows.windows, state.buffers);
  if (windows === state.windows && layout === state.layout && buffers === state.buffers) {
    return state;
  }
  return { ...state, windows, layout, buffers };
}

/** A layout action: the desktops moved along, the active window following focus. */
function applyLayout(state: AppState, action: LayoutAction): AppState {
  const { windows, layout } = applyLayoutAction(state, action);
  return windows === state.windows && layout === state.layout
    ? state
    : { ...state, windows, layout };
}

/** Everything a window shows, wiped from its scrollback; `/clear` and Ctrl+L. */
function applyClear(state: AppState, windowId: string): AppState {
  return replacing(state, 'buffers', clearedBuffers(state.buffers, windowId));
}

/** The mode the keyboard is in. */
function applyMode(state: AppState, mode: InputModeState): AppState {
  return state.mode === mode ? state : { ...state, mode };
}
