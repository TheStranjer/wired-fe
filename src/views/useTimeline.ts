/**
 * The timeline loader for one window (AGENTS.md "Layout": src/views renders
 * what every window shares). The window's own buffer drives everything: an
 * idle buffer asks for its first page, a bumped `olderRequests` asks for the
 * next older one, and every outcome goes to the application's one reducer.
 * Which timeline arrives as a {@link FetchPage}: the caller binds its endpoint
 * and this hook supplies the session, the page and the cancel signal.
 * Unmounting aborts the page in flight and ignores what it answers.
 */

import { useEffect, useRef, type RefObject } from 'react';

import { type ApiError, describeApiError } from '../api/errors';
import type { Page, PageRequest } from '../api/page';
import type { PageCursor } from '../api/pagination';
import type { Status } from '../api/schemas/status';
import type { ApiSession } from '../api/session';
import type { Result } from '../lib/result';
import type { BufferLoad } from '../state/buffer';
import type { Where } from '../state/bufferPosts';
import { bufferFor, sessionFor, windowAccountKey } from '../state/selectors';
import { type Dispatch, useAppDispatch, useAppState } from '../state/StateContext';

/** One page of a timeline, fetched through {@link ApiSession} or cancelled. */
export type FetchPage = (
  session: ApiSession,
  page: PageRequest | undefined,
  signal: AbortSignal,
) => Promise<Result<Page<Status>, ApiError>>;

/** How many statuses one timeline page asks for. */
export const TIMELINE_PAGE_SIZE = 40;

/** The line printed at a window that has no account to fetch with. */
const NO_ACCOUNT = 'No account for this window';

/** What the newest render would fetch with, kept live for the effects. */
type Live = {
  readonly dispatch: Dispatch;
  readonly fetchPage: FetchPage;
  readonly session: ApiSession | null;
};

/** {@link Live}'s pieces once a session stands behind them. */
type Ready = {
  readonly dispatch: Dispatch;
  readonly fetchPage: FetchPage;
  readonly session: ApiSession;
};

/** Which page to fetch and where it lands in the window's scrollback. */
type PageJob = {
  readonly request: PageRequest;
  readonly where: Where;
  readonly windowId: string;
};

/** The newest render's fetch inputs, so effects run on state, not identity. */
function useLive(
  session: ApiSession | null,
  fetchPage: FetchPage,
  dispatch: Dispatch,
): RefObject<Live> {
  const liveRef = useRef<Live>({ session, fetchPage, dispatch });
  useEffect(() => {
    liveRef.current = { session, fetchPage, dispatch };
  }, [session, fetchPage, dispatch]);
  return liveRef;
}

/**
 * Fetch one page and report it: statuses at the asked end plus the load
 * carrying the next cursor; a failure prints its description and fails the
 * load. A page cancelled by unmount reports nothing at all.
 */
async function runFetch(ready: Ready, signal: AbortSignal, job: PageJob): Promise<void> {
  const outcome = await ready.fetchPage(ready.session, job.request, signal);
  const { windowId } = job;
  if (signal.aborted) {
    return;
  }
  if (outcome.ok) {
    const { items, links } = outcome.value;
    ready.dispatch({ statuses: items, type: 'statuses', where: job.where, windowId });
    ready.dispatch({
      exhausted: links.next === null,
      load: 'loaded',
      olderCursor: links.next,
      type: 'load',
      windowId,
    });
    return;
  }
  if (outcome.error.kind === 'aborted') {
    return;
  }
  ready.dispatch({
    date: new Date(),
    level: 'error',
    text: describeApiError(outcome.error),
    type: 'print',
    windowId,
  });
  ready.dispatch({ load: 'error', type: 'load', windowId });
}

/** Tell a window with no account once, in its own scrollback, and stop. */
function useNoAccountNotice(windowId: string, session: ApiSession | null): void {
  const dispatch = useAppDispatch();
  const printedRef = useRef(false);
  useEffect(() => {
    if (session !== null || printedRef.current) {
      return;
    }
    printedRef.current = true;
    dispatch({ type: 'print', windowId, date: new Date(), level: 'error', text: NO_ACCOUNT });
  }, [session, windowId, dispatch]);
}

/** Fetch the window's first page while its buffer is idle. */
function useFirstPage(windowId: string, load: BufferLoad, liveRef: RefObject<Live>): void {
  const inflightRef = useRef<AbortController | null>(null);
  useEffect(() => () => inflightRef.current?.abort(), []);
  useEffect(() => {
    const live = liveRef.current;
    const { session } = live;
    if (load !== 'idle' || session === null) {
      return;
    }
    live.dispatch({ load: 'loading', type: 'load', windowId });
    const controller = new AbortController();
    inflightRef.current = controller;
    void runFetch({ ...live, session }, controller.signal, {
      request: { limit: TIMELINE_PAGE_SIZE },
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
function useOlderPages(windowId: string, liveRef: RefObject<Live>, older: Older): void {
  const inflightRef = useRef<AbortController | null>(null);
  const handledRef = useRef(0);
  useEffect(() => () => inflightRef.current?.abort(), []);
  useEffect(() => {
    const live = liveRef.current;
    const { session } = live;
    const { exhausted, load, olderCursor, olderRequests } = older;
    if (
      session === null ||
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
    void runFetch({ ...live, session }, controller.signal, {
      request: { cursor: olderCursor, limit: TIMELINE_PAGE_SIZE },
      where: 'older',
      windowId,
    });
  }, [older, windowId, liveRef]);
}

/**
 * Keep one window's timeline filled: the first page when its buffer is idle,
 * each older page when the buffer asks for one, every outcome through the
 * application's reducer, and the page still in flight aborted on unmount.
 */
export function useTimeline(windowId: string, fetchPage: FetchPage): void {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const session = sessionFor(state, windowAccountKey(state, windowId));
  const { exhausted, load, olderCursor, olderRequests } = bufferFor(state, windowId);
  const liveRef = useLive(session, fetchPage, dispatch);
  useNoAccountNotice(windowId, session);
  useFirstPage(windowId, load, liveRef);
  useOlderPages(windowId, liveRef, { exhausted, load, olderCursor, olderRequests });
}
