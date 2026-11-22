/**
 * The one-shot load of a targeted window (AGENTS.md "Windows, like IRC
 * buffers", src/views): the shape the thread, search and DM windows share —
 * while the window's buffer is idle and its account can sign a fetch, run
 * the window's own load once against its target, and abort what is in
 * flight when the window closes. The load itself is the caller's: it gets
 * the session, the target and the cancel signal as one {@link OneShotJob},
 * the way ./usePagedBuffer hands a paged window its pages.
 */

import { useEffect, useRef } from 'react';

import { type ApiError, describeApiError } from '../api/errors';
import type { ApiSession } from '../api/session';
import { printAction } from '../state/appState';
import type { LineLevel } from '../state/buffer';
import { loadAction } from '../state/pageActions';
import { accountByKey, bufferFor, windowAccountKey } from '../state/selectors';
import type { Dispatch } from '../state/StateContext';
import { useAppDispatch, useAppState } from '../state/StateContext';

/** One targeted load: the window's session, its target and a cancel signal. */
export type OneShotJob = {
  readonly session: ApiSession;
  /** The handle, tag or status id the window's ref carries. */
  readonly target: string;
  readonly windowId: string;
  readonly signal: AbortSignal;
  readonly dispatch: Dispatch;
};

/** What the window does with its job; resolves once the load has reported. */
export type OneShotRun = (job: OneShotJob) => Promise<void>;

/** Print {@link text} at {@link level} into the job's window's scrollback. */
export function printToJob(
  job: Pick<OneShotJob, 'windowId' | 'dispatch'>,
  level: LineLevel,
  text: string,
): void {
  job.dispatch(printAction(job.windowId, level, text));
}

/** Print why the load never answered, once, and fail the window's load. */
export function failJob(job: Pick<OneShotJob, 'windowId' | 'dispatch'>, error: ApiError): void {
  printToJob(job, 'error', describeApiError(error));
  job.dispatch(loadAction(job.windowId, 'error'));
}

/**
 * Load the window {@link windowId} once: while its buffer is idle and its
 * account stands, hand {@link run} the session, the target and a fresh
 * cancel signal; pass away with the window what the instance has not
 * answered yet. A window with no target and no signed-in owner asks for
 * nothing at all.
 */
export function useOneShotLoad(windowId: string, run: OneShotRun): void {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const target = state.windows.windows.find((win) => win.id === windowId)?.ref.target ?? null;
  const owner = accountByKey(state, windowAccountKey(state, windowId));
  const origin = owner?.origin ?? '';
  const token = owner?.token ?? null;
  const { load } = bufferFor(state, windowId);
  const inflightRef = useRef<AbortController | null>(null);

  useEffect(() => () => inflightRef.current?.abort(), []);
  useEffect(() => {
    if (target === null || token === null || load !== 'idle') {
      return;
    }
    const controller = new AbortController();
    inflightRef.current = controller;
    dispatch(loadAction(windowId, 'loading'));
    void run({
      session: { origin, token },
      target,
      windowId,
      signal: controller.signal,
      dispatch,
    });
  }, [load, target, origin, token, windowId, dispatch, run]);
}
