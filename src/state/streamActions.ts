/**
 * What one streaming event does to the application (AGENTS.md "Windows, like IRC
 * buffers"): the step between a decoded frame off an account's connection and
 * the actions that carry it into the windows that show it. Pure — it reads the
 * app state and returns actions, touching nothing — so the socket callback can
 * hand it every event and dispatch what comes back, and a test can ask what any
 * frame would do.
 *
 * Which of the account's windows a frame is aimed at is the routing table in
 * ./streamTargets: the home, local, federated, hashtag and conversation windows
 * a stream names, and those only. An edit or a delete is not the account's to
 * route — every scrollback that shows the post has to hear about it — so those
 * two come back as one action whatever the window list holds. A notification
 * joins its account's notifications window, and when that window is not what
 * the reader is looking at and the notification is a mention, the fact is
 * printed where they are: `*** @ally@wired.example mentioned you [see notifs]`,
 * the sentence the window itself would have shown (src/views).
 */

import { type AppState, printAction } from './appState';
import type { BufferAction } from './bufferActions';
import { statusesAction } from './pageActions';
import type { AppAction } from './reducer';
import { accountByKey } from './selectors';
import { type Update, updateTargets } from './streamTargets';
import { fullHandle } from '../accounts/handle';
import type { Notification } from '../api/schemas/notification';
import type { StreamEvent } from '../api/streaming';
import type { WindowState } from '../windows/model';

/** The hint that sends the reader to the window they are not looking at. */
const SEE_NOTIFS = '[see notifs]';

/** A frame carrying a post nobody has seen yet. */
type UpdateEvent = Extract<StreamEvent, { readonly kind: 'update' }>;

/** A frame carrying something the account was notified about. */
type NotificationEvent = Extract<StreamEvent, { readonly kind: 'notification' }>;

/** One `statuses` action: the frame's post at the top of the window {@link at}. */
function delivered(at: string, event: UpdateEvent): AppAction {
  return statusesAction(at, [event.status], 'newer');
}

/** One action per window of the account the frame's streams address; nothing at
 * all once that account is gone from the state. */
function updateActions(
  state: AppState,
  accountKey: string,
  event: UpdateEvent,
): readonly AppAction[] {
  const account = accountByKey(state, accountKey);
  if (account === null) {
    return [];
  }
  const update: Update = { status: event.status, stream: event.stream, origin: account.origin };
  return updateTargets(state.windows.windows, accountKey, update).map((win) =>
    delivered(win.id, event),
  );
}

/** The account's notifications window, when one of its windows is open. */
function notificationsWindow(state: AppState, accountKey: string): WindowState | null {
  const found = state.windows.windows.find(
    (win) => win.ref.kind === 'notifications' && win.ref.accountKey === accountKey,
  );
  return found ?? null;
}

/** The action that delivers {@link notification} to the top of a window. */
function arriving(windowId: string, notification: Notification): NotificationsAction {
  return { type: 'notifications', windowId, notifications: [notification], where: 'newer' };
}

/** The notifications action, named for {@link arriving}'s return. */
type NotificationsAction = Extract<BufferAction, { readonly type: 'notifications' }>;

/** The sentence that says an account was mentioned, the actor as the window names them. */
function mentionLine(notification: Notification, origin: string): string {
  return `@${fullHandle(notification.account, origin)} mentioned you ${SEE_NOTIFS}`;
}

/** The notification's window, and — for a mention the reader is not looking at —
 * one line where they are. A window nobody opened is not the active one. */
function notificationActions(
  state: AppState,
  accountKey: string,
  event: NotificationEvent,
): readonly AppAction[] {
  const account = accountByKey(state, accountKey);
  if (account === null) {
    return [];
  }
  const { notification } = event;
  const shown = notificationsWindow(state, accountKey);
  const actions: AppAction[] = [];
  if (shown !== null) {
    actions.push(arriving(shown.id, notification));
  }
  if (notification.kind === 'mention' && state.windows.activeId !== shown?.id) {
    actions.push(printAction(null, 'info', mentionLine(notification, account.origin)));
  }
  return actions;
}

/**
 * The actions to dispatch for one event received on {@link accountKey}'s
 * connection: none for an event WiredFE does not act on, and one broadcast
 * action for an edit or a delete, which every scrollback answers to on its own.
 */
export function streamActions(
  state: AppState,
  accountKey: string,
  event: StreamEvent,
): readonly AppAction[] {
  switch (event.kind) {
    case 'update':
      return updateActions(state, accountKey, event);
    case 'notification':
      return notificationActions(state, accountKey, event);
    case 'statusUpdate':
      return [{ type: 'statusUpdated', status: event.status }];
    case 'delete':
      return [{ type: 'statusDeleted', id: event.id }];
    case 'other':
      return [];
  }
}
