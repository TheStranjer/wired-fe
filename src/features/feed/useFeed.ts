/**
 * The loader of a feed window (decision 14): while its buffer is idle, every
 * source of the feed its ref names is asked for a first page in parallel; each
 * time the buffer asks for older history, only the sources that hold the
 * paging boundary back are asked for the next page (./feedLoad does the
 * asking, merging and showing). The merged items and each source's paging
 * state are kept here, in a ref, because the scrollback only holds the part
 * that is safe to show. A feed whose spec was removed says so into the window
 * and closes the load; unmounting aborts the pages in flight.
 */

import { useCallback, useEffect, useRef } from 'react';

import { type ChooseSources, EMPTY_FEED, type FeedData, blockingRefs, runFeed } from './feedLoad';
import { printAction } from '../../state/appState';
import { feedById } from '../../state/feeds';
import { loadAction } from '../../state/pageActions';
import { useRefreshDeps } from '../../state/RefreshContext';
import { bufferFor } from '../../state/selectors';
import { useAppDispatch, useAppState } from '../../state/StateContext';

/** What a window says when the feed it showed is gone. */
const MISSING = 'This feed no longer exists';

/** Start a load of the sources a chooser picks; the data and the page in flight are kept across renders. */
function useRunner(windowId: string): (choose: ChooseSources) => void {
  const dispatch = useAppDispatch();
  const refresh = useRefreshDeps();
  const { accounts } = useAppState();
  const dataRef = useRef<FeedData>(EMPTY_FEED);
  const inflightRef = useRef<AbortController | null>(null);
  useEffect(() => () => inflightRef.current?.abort(), []);
  return useCallback(
    (choose) => {
      const controller = new AbortController();
      inflightRef.current = controller;
      const write = (data: FeedData): void => {
        dataRef.current = data;
      };
      const read = (): FeedData => dataRef.current;
      void runFeed(
        { windowId, signal: controller.signal, dispatch, refresh, accounts, read, write },
        choose,
      );
    },
    [windowId, dispatch, refresh, accounts],
  );
}

/**
 * Keep one feed window's scrollback filled: the first page of every source
 * while its buffer is idle, the next page of the blocking sources each time
 * the buffer asks for older history, every outcome through the application's
 * reducer.
 */
export function useFeed(windowId: string): void {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const run = useRunner(windowId);
  const handledRef = useRef(0);
  const target = state.windows.windows.find((win) => win.id === windowId)?.ref.target;
  const spec = feedById(state.settings.feeds, target ?? '');
  const { load, exhausted, olderRequests } = bufferFor(state, windowId);

  useEffect(() => {
    if (load !== 'idle') {
      return;
    }
    if (spec === undefined) {
      dispatch(printAction(windowId, 'error', MISSING));
      dispatch(loadAction(windowId, 'loaded', { exhausted: true }));
      return;
    }
    dispatch(loadAction(windowId, 'loading'));
    run(() => spec.sources);
  }, [load, spec, windowId, dispatch, run]);

  useEffect(() => {
    if (
      spec === undefined ||
      load !== 'loaded' ||
      exhausted ||
      olderRequests === handledRef.current
    ) {
      return;
    }
    handledRef.current = olderRequests;
    run((data) => blockingRefs(spec.sources, data));
  }, [spec, load, exhausted, olderRequests, run]);
}
