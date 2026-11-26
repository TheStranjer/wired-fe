/**
 * The timeline loader for one window (AGENTS.md "Layout": src/views renders
 * what every window shares): the shared page loader of ./usePagedBuffer, bound
 * to statuses. Which timeline arrives as a {@link FetchPage}: the caller binds
 * its endpoint and the loader supplies the session, the page and the cancel
 * signal; an arrived page lands as a `statuses` action on the window's buffer.
 */

import type { FetchPageOf } from './pagedFetch';
import { usePagedBuffer } from './usePagedBuffer';
import type { Status } from '../api/schemas/status';
import { statusesAction } from '../state/pageActions';

/** One page of a timeline, fetched through an ApiSession or cancelled. */
export type FetchPage = FetchPageOf<Status>;

/** How many statuses one timeline page asks for. */
export const TIMELINE_PAGE_SIZE = 40;

/**
 * Keep one window's timeline filled: the first page when its buffer is idle,
 * each older page when the buffer asks for one, every outcome through the
 * application's reducer, and the page still in flight aborted on unmount.
 */
export function useTimeline(windowId: string, fetchPage: FetchPage): void {
  usePagedBuffer(windowId, {
    deliver: (items, where, at) => statusesAction(at, items, where),
    fetchPage,
    pageSize: TIMELINE_PAGE_SIZE,
  });
}
