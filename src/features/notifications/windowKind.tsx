/**
 * The `notifications` window kind (AGENTS.md "Windows, like IRC buffers"): one
 * account's notification list — who mentioned, boosted, favourited and followed
 * it — its pages pulled from the notifications endpoint by the shared loader
 * (src/views/useNotifications) and its lines drawn by the shared scrollback
 * (src/views/BufferView). The label is the accessible name of that log region.
 * Nothing is posted into a notifications window: the definition carries no
 * `onPost`, the way window 1 does, so plain text typed while it is active goes
 * nowhere and the dispatcher says so.
 */

import type { JSX } from 'react';

import { listNotifications } from '../../api/endpoints/notifications';
import type { WindowKindDefinition } from '../../state/windowKind';
import { BufferView } from '../../views/BufferView';
import { type FetchNotificationsPage, useNotifications } from '../../views/useNotifications';

/** One page of the account's notifications: the list endpoint, unfiltered. */
const fetchNotificationPage: FetchNotificationsPage = async (session, page, signal) =>
  await listNotifications(session, page === undefined ? {} : { page }, signal);

/** The notifications window: its buffer's lines, kept full by the list endpoint. */
function NotificationsWindow({ windowId }: { readonly windowId: string }): JSX.Element {
  useNotifications(windowId, fetchNotificationPage);
  return <BufferView label="notifications" windowId={windowId} />;
}

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'notifications',
  topic: () => 'notifications',
  Component: NotificationsWindow,
};
