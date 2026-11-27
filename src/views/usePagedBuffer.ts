/**
 * The page loader every window that pages its scrollback shares (AGENTS.md
 * "Layout": src/views renders what every window shares; see ./useTimeline and
 * ./useNotifications, which bind it to one list each). The window's own buffer
 * drives everything: an idle buffer asks for its first page, a bumped
 * `olderRequests` asks for the next older one, and every outcome goes to the
 * application's one reducer. Which list arrives is the caller's: it hands in
 * the fetch and the buffer action that shows an arrived page (./pagedFetch).
 * Unmounting aborts the page in flight and ignores what it answers; a first
 * page cut off that way puts the buffer back to idle, so the window asks
 * again the next time it is shown.
 */

import { useEffect, useRef, type RefObject } from 'react';

import { type PageLoader, runFetch } from './pagedFetch';
import type { PageCursor } from '../api/pagination';
import { t } from '../i18n/translate';
import { printAction } from '../state/appState';
import type { BufferLoad } from '../state/buffer';
import { loadAction } from '../state/pageActions';
import { useRefreshDeps } from '../state/RefreshContext';
import type { RefreshDeps } from '../state/refreshSession';
import { bufferFor, loadKeyFor } from '../state/selectors';
import { type Dispatch, useAppDispatch, useAppState } from '../state/StateContext';

/** What the newest render would fetch with, kept live for the effects. */
type Live<T> = {
  readonly dispatch: Dispatch;
  readonly loader: PageLoader<T>;
  readonly refresh: RefreshDeps;
  readonly accountKey: string | null;
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

/** Tell a window with no account once, in its own scrollback, and stop. */
function useNoAccountNotice(windowId: string, accountKey: string | null): void {
  const dispatch = useAppDispatch();
  const printedRef = useRef(false);
  useEffect(() => {
    if (accountKey !== null || printedRef.current) {
      return;
    }
    printedRef.current = true;
    dispatch(printAction(windowId, 'error', t('views.paging.no_account')));
  }, [accountKey, windowId, dispatch]);
}

/**
 * Fetch the window's first page while its buffer is idle. Unmounting with
 * that page still out aborts it and puts the load back to idle: left at
 * loading, a window hidden before its first page landed would never ask again.
 */
function useFirstPage<T>(windowId: string, load: BufferLoad, liveRef: RefObject<Live<T>>): void {
  const inflightRef = useRef(new Set<AbortController>());
  useEffect(() => {
    const inflight = inflightRef.current;
    const { dispatch } = liveRef.current;
    return () => {
      if (inflight.size === 0) {
        return;
      }
      for (const controller of inflight) {
        controller.abort();
      }
      dispatch(loadAction(windowId, 'idle'));
    };
  }, [windowId, liveRef]);
  useEffect(() => {
    const live = liveRef.current;
    const { accountKey } = live;
    if (load !== 'idle' || accountKey === null) {
      return;
    }
    live.dispatch(loadAction(windowId, 'loading'));
    const controller = new AbortController();
    const inflight = inflightRef.current;
    inflight.add(controller);
    void runFetch({ ...live, accountKey }, controller.signal, {
      request: { limit: live.loader.pageSize },
      where: 'newer',
      windowId,
    }).finally(() => {
      inflight.delete(controller);
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
  const accountKey = loadKeyFor(state, windowId);
  const { exhausted, load, olderCursor, olderRequests } = bufferFor(state, windowId);
  const liveRef = useLive({ dispatch, loader, refresh, accountKey });
  useNoAccountNotice(windowId, accountKey);
  useFirstPage(windowId, load, liveRef);
  useOlderPages(windowId, liveRef, { exhausted, load, olderCursor, olderRequests });
}
