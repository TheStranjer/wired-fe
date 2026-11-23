/**
 * The page loader every window that pages its scrollback shares (AGENTS.md
 * "Layout": src/views renders what every window shares; see ./useTimeline and
 * ./useNotifications, which bind it to one list each). The window's own buffer
 * drives everything: an idle buffer asks for its first page, a bumped
 * `olderRequests` asks for the next older one, and every outcome goes to the
 * application's one reducer. Which list arrives is the caller's: it hands in
 * the fetch and the buffer action that shows an arrived page. Unmounting
 * aborts the page in flight and ignores what it answers.
 */

import { useEffect, useRef, type RefObject } from 'react';

import { type ApiError, describeApiError } from '../api/errors';
import type { Page, PageRequest } from '../api/page';
import type { PageCursor } from '../api/pagination';
import type { ApiSession } from '../api/session';
import type { Result } from '../lib/result';
import { printAction } from '../state/appState';
import type { BufferLoad } from '../state/buffer';
import type { BufferAction } from '../state/bufferActions';
import type { Where } from '../state/bufferPosts';
import { loadAction } from '../state/pageActions';
import { useRefreshDeps } from '../state/RefreshContext';
import { type RefreshDeps, withFreshToken } from '../state/refreshSession';
import { accountByKey, bufferFor, windowAccountKey } from '../state/selectors';
import { type Dispatch, useAppDispatch, useAppState } from '../state/StateContext';

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

/** The line printed at a window that has no account to fetch with. */
const NO_ACCOUNT = 'No account for this window';

/** What the newest render would fetch with, kept live for the effects. */
type Live<T> = {
  readonly dispatch: Dispatch;
  readonly loader: PageLoader<T>;
  readonly refresh: RefreshDeps;
  readonly accountKey: string | null;
};

/** {@link Live}'s pieces once an account stands behind them. */
type Ready<T> = {
  readonly dispatch: Dispatch;
  readonly loader: PageLoader<T>;
  readonly refresh: RefreshDeps;
  readonly accountKey: string;
};

/** Which page to fetch and where it lands in the window's scrollback. */
type PageJob = {
  readonly request: PageRequest;
  readonly where: Where;
  readonly windowId: string;
};

/** The newest render's fetch inputs, so effects run on state, not identity. */
function useLive<T>(live: Live<T>): RefObject<Live<T>> {
  const liveRef = useRef<Live<T>>(live);
  const { dispatch, loader, refresh, accountKey } = live;
  useEffect(() => {
    liveRef.current = { dispatch, loader, refresh, accountKey };
  }, [dispatch, loader, refresh, accountKey]);
  return liveRef;
}

/**
 * Fetch one page and report it: items at the asked end plus the load
 * carrying the next cursor; a failure prints its description and fails the
 * load. A page cancelled by unmount reports nothing at all.
 */
async function runFetch<T>(ready: Ready<T>, signal: AbortSignal, job: PageJob): Promise<void> {
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

/** Tell a window with no account once, in its own scrollback, and stop. */
function useNoAccountNotice(windowId: string, accountKey: string | null): void {
  const dispatch = useAppDispatch();
  const printedRef = useRef(false);
  useEffect(() => {
    if (accountKey !== null || printedRef.current) {
      return;
    }
    printedRef.current = true;
    dispatch(printAction(windowId, 'error', NO_ACCOUNT));
  }, [accountKey, windowId, dispatch]);
}

/** Fetch the window's first page while its buffer is idle. */
function useFirstPage<T>(windowId: string, load: BufferLoad, liveRef: RefObject<Live<T>>): void {
  const inflightRef = useRef<AbortController | null>(null);
  useEffect(() => () => inflightRef.current?.abort(), []);
  useEffect(() => {
    const live = liveRef.current;
    const { accountKey } = live;
    if (load !== 'idle' || accountKey === null) {
      return;
    }
    live.dispatch(loadAction(windowId, 'loading'));
    const controller = new AbortController();
    inflightRef.current = controller;
    void runFetch({ ...live, accountKey }, controller.signal, {
      request: { limit: live.loader.pageSize },
      where: 'newer',
      windowId,
    });
  }, [load, windowId, liveRef]);
}

/** The buffer fields that decide whether the next older page is due. */
type Older = {
  readonly exhausted: boolean;
  readonly load: BufferLoad;
  readonly olderCursor: PageCursor | null;
  readonly olderRequests: number;
};

/** Fetch an older page whenever the window asks for one it can still get. */
function useOlderPages<T>(windowId: string, liveRef: RefObject<Live<T>>, older: Older): void {
  const inflightRef = useRef<AbortController | null>(null);
  const handledRef = useRef(0);
  useEffect(() => () => inflightRef.current?.abort(), []);
  useEffect(() => {
    const live = liveRef.current;
    const { accountKey } = live;
    const { exhausted, load, olderCursor, olderRequests } = older;
    if (
      accountKey === null ||
      load !== 'loaded' ||
      exhausted ||
      olderCursor === null ||
      olderRequests === handledRef.current
    ) {
      return;
    }
    handledRef.current = olderRequests;
    const controller = new AbortController();
    inflightRef.current = controller;
    void runFetch({ ...live, accountKey }, controller.signal, {
      request: { cursor: olderCursor, limit: live.loader.pageSize },
      where: 'older',
      windowId,
    });
  }, [older, windowId, liveRef]);
}

/**
 * Keep one window's scrollback filled: the first page when its buffer is
 * idle, each older page when the buffer asks for one, every outcome through
 * the application's reducer, and the page still in flight aborted on unmount.
 */
export function usePagedBuffer<T>(windowId: string, loader: PageLoader<T>): void {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const refresh = useRefreshDeps();
  const accountKey = accountByKey(state, windowAccountKey(state, windowId))?.key ?? null;
  const { exhausted, load, olderCursor, olderRequests } = bufferFor(state, windowId);
  const liveRef = useLive({ dispatch, loader, refresh, accountKey });
  useNoAccountNotice(windowId, accountKey);
  useFirstPage(windowId, load, liveRef);
  useOlderPages(windowId, liveRef, { exhausted, load, olderCursor, olderRequests });
}
