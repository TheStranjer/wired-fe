/**
 * The buffer half of the app reducer: what arrives in a window's scrollback and
 * what the reader does to it (AGENTS.md "Windows, like IRC buffers"). Pages of
 * statuses and notifications come off the API through the transitions in
 * ./bufferPosts and ./bufferNotifications; one that lands in a window nobody is
 * looking at leaves that window unread, highlighted when a line that joined
 * speaks to its account — which is what ./bufferUnread decides.
 * Selection, content warnings, the load state and the asks for older history are
 * the reader's own moves; an edited or deleted status reaches every scrollback.
 * As everywhere in src/state each case hands back the very same state when its
 * request changes nothing, and an action naming a closed window changes nothing.
 */

import { putBuffer } from './appReducer';
import type { AppState } from './appState';
import type { Buffer, BufferLoad } from './buffer';
import { addNotificationsAs } from './bufferNotifications';
import { addStatusesAs, removeStatus, replaceStatus, type Where } from './bufferPosts';
import { selectEdge, selectKey, selectRelative, toggleRevealed } from './bufferSelection';
import { addedLines, markArrivals } from './bufferUnread';
import { windowAccountKey } from './selectors';
import type { PageCursor } from '../api/pagination';
import type { Notification } from '../api/schemas/notification';
import type { Status } from '../api/schemas/status';

/** One thing that can happen to the window scrollbacks. */
export type BufferAction =
  | {
      readonly type: 'statuses';
      readonly windowId: string;
      readonly statuses: readonly Status[];
      readonly where: Where;
    }
  | {
      readonly type: 'notifications';
      readonly windowId: string;
      readonly notifications: readonly Notification[];
      readonly where: Where;
    }
  | { readonly type: 'statusUpdated'; readonly status: Status }
  | { readonly type: 'statusDeleted'; readonly id: string }
  | { readonly type: 'select'; readonly windowId: string; readonly key: string | null }
  | { readonly type: 'selectRelative'; readonly windowId: string; readonly delta: number }
  | { readonly type: 'selectEdge'; readonly windowId: string; readonly edge: 'first' | 'last' }
  | { readonly type: 'toggleReveal'; readonly windowId: string; readonly key: string }
  | {
      readonly type: 'load';
      readonly windowId: string;
      readonly load: BufferLoad;
      readonly olderCursor?: PageCursor | null;
      readonly exhausted?: boolean;
    }
  | { readonly type: 'requestOlder'; readonly windowId: string };

/** A fetched page arriving in one window. */
type PageAction = Extract<BufferAction, { readonly where: Where }>;

/** The load action, named so its optional paging fields travel as one. */
type LoadAction = Extract<BufferAction, { readonly type: 'load' }>;

/** A status every window that shows it has to hear about. */
type BroadcastAction = Extract<BufferAction, { readonly type: 'statusUpdated' | 'statusDeleted' }>;

/** Anything that happens to the one window the action names. */
type WindowAction = Exclude<BufferAction, BroadcastAction>;

/** The broadcast types, every one named, so a new action has to say where it goes. */
const BROADCAST_TYPES: Record<BroadcastAction['type'], true> = {
  statusUpdated: true,
  statusDeleted: true,
};

/** Move the app state along by one buffer action; the same state when nothing changes. */
export function bufferReducer(state: AppState, action: BufferAction): AppState {
  if (isBroadcast(action)) {
    return applyBroadcast(state, action);
  }
  return applyInWindow(state, action);
}

/** Whether every scrollback has to hear about this action, not just one window's. */
function isBroadcast(action: BufferAction): action is BroadcastAction {
  return Object.hasOwn(BROADCAST_TYPES, action.type);
}

/** An edited or deleted status, reported to every scrollback that shows it. */
function applyBroadcast(state: AppState, action: BroadcastAction): AppState {
  return action.type === 'statusUpdated'
    ? applyEveryBuffer(state, (buffer) => replaceStatus(buffer, action.status))
    : applyEveryBuffer(state, (buffer) => removeStatus(buffer, action.id));
}

/** What the one window the action names does with its buffer. */
function applyInWindow(state: AppState, action: WindowAction): AppState {
  switch (action.type) {
    case 'statuses':
    case 'notifications':
      return applyPage(state, action);
    case 'select':
      return applyToBuffer(state, action, (buffer) => selectKey(buffer, action.key));
    case 'selectRelative':
      return applyToBuffer(state, action, (buffer) => selectRelative(buffer, action.delta));
    case 'selectEdge':
      return applyToBuffer(state, action, (buffer) => selectEdge(buffer, action.edge));
    case 'toggleReveal':
      return applyToBuffer(state, action, (buffer) => toggleRevealed(buffer, action.key));
    case 'load':
      return applyToBuffer(state, action, (buffer) => applyLoad(buffer, action));
    case 'requestOlder':
      return applyToBuffer(state, action, askForOlder);
  }
}

/** A page of lines joining one window, and the unread mark it leaves behind. */
function applyPage(state: AppState, action: PageAction): AppState {
  const before = state.buffers.get(action.windowId);
  if (before === undefined) {
    return state;
  }
  const accountKey = windowAccountKey(state, action.windowId);
  const after =
    action.type === 'statuses'
      ? addStatusesAs(accountKey)(before, action.statuses, action.where)
      : addNotificationsAs(accountKey)(before, action.notifications, action.where);
  const buffers = putBuffer(state.buffers, action.windowId, after);
  const added = action.where === 'newer' ? addedLines(before, after) : [];
  const windows = markArrivals(state, action.windowId, added);
  if (buffers === state.buffers && windows === state.windows) {
    return state;
  }
  return { ...state, buffers, windows };
}

/** The buffers with one transition applied to every window's own. */
function applyEveryBuffer(state: AppState, show: (buffer: Buffer) => Buffer): AppState {
  const buffers = new Map<string, Buffer>();
  let changed = false;
  for (const [id, buffer] of state.buffers) {
    const next = show(buffer);
    changed = changed || next !== buffer;
    buffers.set(id, next);
  }
  return changed ? { ...state, buffers } : state;
}

/** The buffers of the one window {@link action} names, or the same map. */
function applyToBuffer(
  state: AppState,
  action: { readonly windowId: string },
  transition: (buffer: Buffer) => Buffer,
): AppState {
  const buffer = state.buffers.get(action.windowId);
  if (buffer === undefined) {
    return state;
  }
  const next = transition(buffer);
  return next === buffer
    ? state
    : { ...state, buffers: putBuffer(state.buffers, action.windowId, next) };
}

/** The window's load state, and the paging fields that came with it. */
function applyLoad(buffer: Buffer, action: LoadAction): Buffer {
  const next: Buffer = {
    ...buffer,
    ...(action.olderCursor === undefined ? {} : { olderCursor: action.olderCursor }),
    ...(action.exhausted === undefined ? {} : { exhausted: action.exhausted }),
    load: action.load,
  };
  return sameLoad(buffer, next) ? buffer : next;
}

/** Whether the three fields {@link applyLoad} owns already agree. */
function sameLoad(one: Buffer, two: Buffer): boolean {
  return (
    one.load === two.load && one.olderCursor === two.olderCursor && one.exhausted === two.exhausted
  );
}

/** One more ask for older history; a window at the end of it asks for nothing. */
function askForOlder(buffer: Buffer): Buffer {
  return buffer.exhausted ? buffer : { ...buffer, olderRequests: buffer.olderRequests + 1 };
}
