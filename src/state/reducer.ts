/**
 * The application's one reducer (AGENTS.md "Layout": src/state is the pure app
 * state, which the React context then puts in front of the shell). A command, a
 * hotkey and a click all ask for a transition here, so the shell holds one state
 * and one function that moves it: the window list, the accounts and the settings
 * turn over in ./appState, the scrollbacks in ./bufferActions, the pane
 * composers' drafts in ./composerActions. Which reducer owns which action is
 * spelled out type by type: the tables below have to name every member of
 * {@link BufferAction} and {@link ComposerAction} for this file to compile, and
 * anything they do not name goes to `coreReducer`, whose own switch is
 * exhaustive — so a new action cannot quietly find no home.
 */

import { type AppState, type CoreAction, coreReducer } from './appState';
import { bufferReducer, type BufferAction } from './bufferActions';
import { type ComposerAction, composerReducer, withLiveComposers } from './composerActions';

/** One thing that can happen to the application as a whole. */
export type AppAction = CoreAction | BufferAction | ComposerAction;

/** The action types the buffer reducer owns, every one of them by name. */
const BUFFER_ACTION_TYPES: Record<BufferAction['type'], true> = {
  statuses: true,
  notifications: true,
  feed: true,
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

/** Move the app state along by one action; the same state when nothing changes. */
export function appReducer(state: AppState, action: AppAction): AppState {
  if (isBufferAction(action)) {
    return bufferReducer(state, action);
  }
  if (isComposerAction(action)) {
    return composerReducer(state, action);
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
