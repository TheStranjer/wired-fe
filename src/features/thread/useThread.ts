/**
 * The one-shot load of one thread window (WFE-104, AGENTS.md "Windows, like
 * IRC buffers"): the status the window targets and the conversation around
 * it, fetched concurrently through the window's own account with `getStatus`
 * and `getContext`. The API answers ancestors and descendants oldest first,
 * so the whole thread — ancestors, the status, replies — is reversed into API
 * order and handed to the buffer as one `statuses` action, which turns each
 * batch back around: the window reads top to bottom in conversation order.
 * The selection takes the target's line and the load ends `loaded` and
 * exhausted — a thread has no older page to ask for. A failed fetch prints
 * its description into the window the way the page loaders do, and a fetch
 * whose window closed while the instance was thinking reports nothing at all.
 */

import { useEffect, useRef } from 'react';

import { getContext, getStatus } from '../../api/endpoints/statusRead';
import { type ApiError, describeApiError } from '../../api/errors';
import type { ApiSession } from '../../api/session';
import { postKey } from '../../state/bufferPosts';
import { accountByKey, bufferFor, windowAccountKey } from '../../state/selectors';
import type { Dispatch } from '../../state/StateContext';
import { useAppDispatch, useAppState } from '../../state/StateContext';

/** The signed-in account's session, target id and cancel signal, with a dispatch. */
export type ThreadJob = {
  readonly session: ApiSession;
  readonly id: string;
  readonly windowId: string;
  readonly signal: AbortSignal;
  readonly dispatch: Dispatch;
};

/** Print why the thread never arrived, once, into the window's scrollback. */
function printFailure(job: ThreadJob, error: ApiError): void {
  job.dispatch({
    type: 'print',
    windowId: job.windowId,
    date: new Date(),
    level: 'error',
    text: describeApiError(error),
  });
  job.dispatch({ type: 'load', windowId: job.windowId, load: 'error' });
}

/**
 * Fetch the status and its context concurrently and report once: the whole
 * thread as one newest-first `statuses` action, the selection on the target's
 * line, and the load closed exhausted; or the first failure printed into the
 * window. A job whose signal is already aborted reports nothing at all.
 */
export async function fetchThread(job: ThreadJob): Promise<void> {
  const [found, around] = await Promise.all([
    getStatus(job.session, job.id, job.signal),
    getContext(job.session, job.id, job.signal),
  ]);
  if (job.signal.aborted) {
    return;
  }
  if (!found.ok) {
    printFailure(job, found.error);
    return;
  }
  if (!around.ok) {
    printFailure(job, around.error);
    return;
  }
  const thread = [...around.value.ancestors, found.value, ...around.value.descendants];
  job.dispatch({
    type: 'statuses',
    windowId: job.windowId,
    statuses: thread.toReversed(),
    where: 'newer',
  });
  job.dispatch({ type: 'select', windowId: job.windowId, key: postKey(job.id) });
  job.dispatch({ type: 'load', windowId: job.windowId, load: 'loaded', exhausted: true });
}

/**
 * Fill the thread window {@link windowId} once: while its buffer is idle and
 * its account can sign the fetch, load its target's conversation through the
 * application's reducer and abort with the window. A window with no target
 * and no signed-in owner ask for nothing at all.
 */
export function useThread(windowId: string): void {
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
    dispatch({ type: 'load', windowId, load: 'loading' });
    void fetchThread({
      session: { origin, token },
      id: target,
      windowId,
      signal: controller.signal,
      dispatch,
    });
  }, [load, target, origin, token, windowId, dispatch]);
}
