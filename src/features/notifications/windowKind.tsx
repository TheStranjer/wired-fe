/**
 * The `notifications` window kind (AGENTS.md "Windows, like IRC buffers"): one
 * account's notification list — who mentioned, boosted, favourited and followed
 * it — its pages pulled from the notifications endpoint by the shared loader
 * (src/views/useNotifications) and its lines drawn by the shared scrollback
 * (src/views/BufferView). The label is the accessible name of that log region.
 * Plain text typed while it is active posts as the window's account
 * (src/state/postAsWindowAccount) without entering the list, which is not a
 * timeline; a `posted as @handle` line confirms it.
 */

import type { JSX } from 'react';

import { listNotifications } from '../../api/endpoints/notifications';
import { postAsWindowAccount } from '../../state/postAsWindowAccount';
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
  onPost: postAsWindowAccount,
};
