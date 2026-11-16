/**
 * The notifications loader for one window: the same contract as
 * {@link useTimeline} — the first page while the buffer is idle, each older
 * page when the buffer asks for one — bound to the notification list instead
 * of a timeline. The caller hands in a {@link FetchNotificationsPage} (the
 * `listNotifications` endpoint, already bound); an arrived page lands as a
 * `notifications` action on the window's buffer (src/state/bufferNotifications).
 */

import { type FetchPageOf, usePagedBuffer } from './usePagedBuffer';
import type { Notification } from '../api/schemas/notification';

/** One page of notifications, fetched through an ApiSession or cancelled. */
export type FetchNotificationsPage = FetchPageOf<Notification>;

/** How many notifications one page asks for; the timeline's own page size. */
export const NOTIFICATIONS_PAGE_SIZE = 40;

/**
 * Keep one window's notifications filled: the first page when its buffer is
 * idle, each older page when the buffer asks for one, every outcome through
 * the application's reducer, and the page still in flight aborted on unmount.
 */
export function useNotifications(windowId: string, fetchPage: FetchNotificationsPage): void {
  usePagedBuffer(windowId, {
    deliver: (items, where, at) => ({
      notifications: items,
      type: 'notifications',
      where,
      windowId: at,
    }),
    fetchPage,
    pageSize: NOTIFICATIONS_PAGE_SIZE,
  });
}
