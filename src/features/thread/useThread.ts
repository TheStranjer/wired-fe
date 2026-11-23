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

import { getContext, getStatus } from '../../api/endpoints/statusRead';
import { postKey } from '../../state/bufferPosts';
import { loadAction, statusesAction } from '../../state/pageActions';
import type { WithToken } from '../../state/refreshSession';
import type { Dispatch } from '../../state/StateContext';
import { failJob, useOneShotLoad, type OneShotJob } from '../../views/useOneShotLoad';

/** The signed-in account's session, target id and cancel signal, with a dispatch. */
export type ThreadJob = {
  readonly withToken: WithToken;
  readonly id: string;
  readonly windowId: string;
  readonly signal: AbortSignal;
  readonly dispatch: Dispatch;
};

/**
 * Fetch the status and its context concurrently and report once: the whole
 * thread as one newest-first `statuses` action, the selection on the target's
 * line, and the load closed exhausted; or the first failure printed into the
 * window. A job whose signal is already aborted reports nothing at all.
 */
export async function fetchThread(job: ThreadJob): Promise<void> {
  const [found, around] = await Promise.all([
    job.withToken(async (session) => await getStatus(session, job.id, job.signal)),
    job.withToken(async (session) => await getContext(session, job.id, job.signal)),
  ]);
  if (job.signal.aborted) {
    return;
  }
  if (!found.ok) {
    failJob(job, found.error);
    return;
  }
  if (!around.ok) {
    failJob(job, around.error);
    return;
  }
  const thread = [...around.value.ancestors, found.value, ...around.value.descendants];
  job.dispatch(statusesAction(job.windowId, thread.toReversed(), 'newer'));
  job.dispatch({ type: 'select', windowId: job.windowId, key: postKey(job.id) });
  job.dispatch(loadAction(job.windowId, 'loaded', { exhausted: true }));
}

/** The thread window answers its target id with one {@link fetchThread}. */
async function runThread(job: OneShotJob): Promise<void> {
  await fetchThread({ ...job, id: job.target });
}

/**
 * Fill the thread window {@link windowId} once: while its buffer is idle and
 * its account can sign the fetch, load its target's conversation through
 * the application's reducer and abort with the window. A window with no
 * target and no signed-in owner asks for nothing at all.
 */
export function useThread(windowId: string): void {
  useOneShotLoad(windowId, runThread);
}
