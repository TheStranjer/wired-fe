/**
 * One page fetch of the shared page loader (./usePagedBuffer): which list a
 * window pages, how an arrived page is shown, and the fetch that reports one
 * page to the application's reducer. A page cancelled by unmount reports
 * nothing; the loader itself puts the window's load back.
 */

import { type ApiError, describeApiError } from '../api/errors';
import type { Page, PageRequest } from '../api/page';
import type { ApiSession } from '../api/session';
import type { Result } from '../lib/result';
import { printAction } from '../state/appState';
import type { BufferAction } from '../state/bufferActions';
import type { Where } from '../state/bufferPosts';
import { loadAction } from '../state/pageActions';
import { type RefreshDeps, withFreshToken } from '../state/refreshSession';
import type { Dispatch } from '../state/StateContext';

/** One page of a window's list of `T`, fetched through {@link ApiSession} or cancelled. */
export type FetchPageOf<T> = (
  session: ApiSession,
  page: PageRequest | undefined,
  signal: AbortSignal,
) => Promise<Result<Page<T>, ApiError>>;

/** One window's loader: which list to fetch, how to show it, and page size. */
export type PageLoader<T> = {
  /** Which list arrives as one page: the caller's endpoint, already bound. */
  readonly fetchPage: FetchPageOf<T>;
  /** The buffer action that puts an arrived page on the window's scrollback. */
  readonly deliver: (items: readonly T[], where: Where, windowId: string) => BufferAction;
  /** How many items one page asks for. */
  readonly pageSize: number;
};

/** What one fetch needs once an account stands behind it. */
export type Ready<T> = {
  readonly dispatch: Dispatch;
  readonly loader: PageLoader<T>;
  readonly refresh: RefreshDeps;
  readonly accountKey: string;
};

/** Which page to fetch and where it lands in the window's scrollback. */
export type PageJob = {
  readonly request: PageRequest;
  readonly where: Where;
  readonly windowId: string;
};

/**
 * Fetch one page and report it: items at the asked end plus the load
 * carrying the next cursor; a failure prints its description and fails the
 * load. A page cancelled by unmount reports nothing at all.
 */
export async function runFetch<T>(
  ready: Ready<T>,
  signal: AbortSignal,
  job: PageJob,
): Promise<void> {
  const outcome = await withFreshToken(
    ready.refresh,
    ready.accountKey,
    async (session) => await ready.loader.fetchPage(session, job.request, signal),
  );
  const { windowId } = job;
  if (signal.aborted) {
    return;
  }
  if (outcome.ok) {
    const { items, links } = outcome.value;
    ready.dispatch(ready.loader.deliver(items, job.where, windowId));
    ready.dispatch(
      loadAction(windowId, 'loaded', { exhausted: links.next === null, olderCursor: links.next }),
    );
    return;
  }
  if (outcome.error.kind === 'aborted') {
    return;
  }
  ready.dispatch(printAction(windowId, 'error', describeApiError(outcome.error)));
  ready.dispatch(loadAction(windowId, 'error'));
}
