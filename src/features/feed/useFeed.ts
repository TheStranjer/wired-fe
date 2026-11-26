/**
 * The loader of a feed window (decision 14): while its buffer is idle, every
 * source of the feed its ref names is asked for a first page in parallel; each
 * time the buffer asks for older history, only the sources that hold the
 * paging boundary back are asked for the next page (./feedLoad does the
 * asking). The merged items and each source's paging state are kept on the
 * window's buffer, because the scrollback only holds the part that is safe to
 * show, and the streams deliver to the same feed. A feed whose spec was removed
 * says so into the window and closes the load; unmounting aborts the pages in
 * flight.
 */

import { useCallback, useEffect, useRef } from 'react';

import { type ChooseSources, blockingRefs, runFeed } from './feedLoad';
import { t } from '../../i18n/translate';
import { printAction } from '../../state/appState';
import { EMPTY_FEED, type FeedData } from '../../state/feedItem';
import { feedById } from '../../state/feeds';
import { loadAction } from '../../state/pageActions';
import { useRefreshDeps } from '../../state/RefreshContext';
import { bufferFor } from '../../state/selectors';
import { useAppDispatch, useAppState } from '../../state/StateContext';

/** Start a load of the sources a chooser picks; the page in flight is kept across renders. */
function useRunner(windowId: string): (choose: ChooseSources) => void {
  const dispatch = useAppDispatch();
  const refresh = useRefreshDeps();
  const { accounts } = useAppState();
  const inflightRef = useRef<AbortController | null>(null);
  useEffect(() => () => inflightRef.current?.abort(), []);
  return useCallback(
    (choose) => {
      const controller = new AbortController();
      inflightRef.current = controller;
      const read = (): FeedData => bufferFor(refresh.getState(), windowId).feed ?? EMPTY_FEED;
      void runFeed(
        { windowId, signal: controller.signal, dispatch, refresh, accounts, read },
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
      dispatch(printAction(windowId, 'error', t('features.feed.missing')));
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
