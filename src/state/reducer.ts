/**
 * The application's one reducer (AGENTS.md "Layout": src/state is the pure app
 * state, which the React context then puts in front of the shell). A command, a
 * hotkey and a click all ask for a transition here, so the shell holds one state
 * and one function that moves it: the window list, the accounts and the settings
 * turn over in ./appState, the scrollbacks in ./bufferActions, the pane
 * composers' drafts in ./composerActions and their attachments in
 * ./composerMedia. Which reducer owns which action is spelled out type by type:
 * the tables below have to name every member of {@link BufferAction},
 * {@link ComposerAction} and {@link ComposerMediaAction} for this file to
 * compile, and
 * anything they do not name goes to `coreReducer`, whose own switch is
 * exhaustive — so a new action cannot quietly find no home.
 */

import { type AccountPickAction, accountPickReducer } from './accountPick';
import { type AlertAction, withAlertDismissed } from './alerts';
import { type AnonRefusalAction, anonRefusalReducer } from './anonRefusal';
import { type AppState, type CoreAction, coreReducer } from './appState';
import { bufferReducer, type BufferAction } from './bufferActions';
import { type ComposerAction, composerReducer, withLiveComposers } from './composerActions';
import { type ComposerMediaAction, composerMediaReducer } from './composerMedia';
import { type RestoreAction, restoreReducer } from './deskRestore';
import { type LanguageMenuAction, languageMenuReducer } from './languageMenu';
import { type PlaceAction, placeReducer } from './placeAction';
import { type SignInAction, signInReducer } from './signIn';
import { type StartMenuAction, startMenuReducer } from './startMenu';
import { type SyncAction, syncReducer } from './syncStatus';

/** One thing that can happen to the application as a whole. */
export type AppAction =
  | CoreAction
  | RestoreAction
  | SignInAction
  | AnonRefusalAction
  | SyncAction
  | AlertAction
  | AccountPickAction
  | StartMenuAction
  | LanguageMenuAction
  | PlaceAction
  | BufferAction
  | ComposerAction
  | ComposerMediaAction;

/** The action types the buffer reducer owns, every one of them by name. */
const BUFFER_ACTION_TYPES: Record<BufferAction['type'], true> = {
  statuses: true,
  notifications: true,
  feed: true,
  feedLive: true,
  statusUpdated: true,
  statusDeleted: true,
  select: true,
  selectRelative: true,
  selectEdge: true,
  toggleReveal: true,
  load: true,
  requestOlder: true,
};

/** The action types the composer reducer owns, every one of them by name. */
const COMPOSER_ACTION_TYPES: Record<ComposerAction['type'], true> = {
  composerEdit: true,
  composerAppend: true,
};

/** The sign-in, sync, alert, account picker, start menu and language list actions: each a one-line transition, handled by {@link smallReducer}. */
type SmallAction =
  | SignInAction
  | AnonRefusalAction
  | SyncAction
  | AlertAction
  | AccountPickAction
  | StartMenuAction
  | LanguageMenuAction;

/** The action types of {@link SmallAction}, every one of them by name. */
const SMALL_ACTION_TYPES: Record<SmallAction['type'], true> = {
  signedIn: true,
  anonRefused: true,
  anonHandled: true,
  sync: true,
  syncUnsupported: true,
  dismissAlert: true,
  openAccountPick: true,
  closeAccountPick: true,
  startMenu: true,
  languageMenu: true,
};

/** Whether this action is one of the small slices' (sign-in, sync, alerts, account picker). */
function isSmallAction(action: AppAction): action is SmallAction {
  return Object.hasOwn(SMALL_ACTION_TYPES, action.type);
}

/** The account picker, start menu and language list actions. */
type MenuAction = AccountPickAction | StartMenuAction | LanguageMenuAction;

/** The action types of {@link MenuAction}. */
const MENU_ACTION_TYPES: ReadonlySet<string> = new Set([
  'openAccountPick',
  'closeAccountPick',
  'startMenu',
  'languageMenu',
]);

/** Whether this small action is one of the menus'. */
function isMenuAction(action: SmallAction): action is MenuAction {
  return MENU_ACTION_TYPES.has(action.type);
}

/** The transition of one account picker, start menu or language list action. */
function menuReducer(state: AppState, action: MenuAction): AppState {
  switch (action.type) {
    case 'openAccountPick':
    case 'closeAccountPick':
      return accountPickReducer(state, action);
    case 'startMenu':
      return startMenuReducer(state, action);
    case 'languageMenu':
      return languageMenuReducer(state, action);
  }
}

/** The transition of one {@link SmallAction}. */
function smallReducer(state: AppState, action: SmallAction): AppState {
  if (isMenuAction(action)) {
    return menuReducer(state, action);
  }
  switch (action.type) {
    case 'signedIn':
      return signInReducer(state, action);
    case 'anonRefused':
    case 'anonHandled':
      return anonRefusalReducer(state, action);
    case 'sync':
    case 'syncUnsupported':
      return syncReducer(state, action);
    case 'dismissAlert':
      return withAlertDismissed(state);
  }
}

/** Move the app state along by one action; the same state when nothing changes. */
export function appReducer(state: AppState, action: AppAction): AppState {
  if (isBufferAction(action)) {
    return bufferReducer(state, action);
  }
  if (isComposerAction(action)) {
    return composerReducer(state, action);
  }
  if (isComposerMediaAction(action)) {
    return composerMediaReducer(state, action);
  }
  if (action.type === 'restore') {
    return withLiveComposers(restoreReducer(state, action));
  }
  if (isSmallAction(action)) {
    return smallReducer(state, action);
  }
  if (action.type === 'openPlaced') {
    return withLiveComposers(placeReducer(state, action));
  }
  return withLiveComposers(coreReducer(state, action));
}

/** Whether this action belongs to the scrollbacks rather than to the rest of the app. */
function isBufferAction(action: AppAction): action is BufferAction {
  return Object.hasOwn(BUFFER_ACTION_TYPES, action.type);
}

/** Whether this action belongs to the pane composers' drafts. */
function isComposerAction(action: AppAction): action is ComposerAction {
  return Object.hasOwn(COMPOSER_ACTION_TYPES, action.type);
}

/** The action types the composer media reducer owns, every one of them by name. */
const COMPOSER_MEDIA_ACTION_TYPES: Record<ComposerMediaAction['type'], true> = {
  composerMediaAdd: true,
  composerMediaPatch: true,
  composerMediaRemove: true,
  composerMediaClear: true,
};

/** Whether this action belongs to the pane composers' attachments. */
function isComposerMediaAction(action: AppAction): action is ComposerMediaAction {
  return Object.hasOwn(COMPOSER_MEDIA_ACTION_TYPES, action.type);
}
