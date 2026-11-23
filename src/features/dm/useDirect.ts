/**
 * The one-shot load of one DM window (WFE-108, AGENTS.md "Windows, like IRC
 * buffers"): the private conversation the window's handle is in, found by
 * paging through the stored conversations — up to three pages of forty,
 * newest activity first — until one names exactly the window's target, the
 * one-on-one conversation with them. The endpoint answers newest first, so
 * the first match is the most recent; its last status is fetched with its
 * context the way the thread window loads a conversation (./useThread), and
 * the whole thread — ancestors, the last word, replies — lands as one
 * newest-first `statuses` action, which the buffer turns back around. The
 * conversation is then marked read, so the unread count goes down with the
 * messages now on screen. A handle nobody has ever messaged says so into the
 * window and closes the load: typing starts the conversation
 * (./windowKind). A failed fetch prints its description the way the page
 * loaders do, and a fetch whose window closed while the instance was
 * thinking reports nothing at all.
 */

import { listConversations, markConversationRead } from '../../api/endpoints/conversations';
import { getContext } from '../../api/endpoints/statusRead';
import type { ApiError } from '../../api/errors';
import type { PageRequest } from '../../api/page';
import type { PageCursor } from '../../api/pagination';
import type { Conversation } from '../../api/schemas/conversation';
import type { Status } from '../../api/schemas/status';
import { type Result, ok } from '../../lib/result';
import { loadAction, statusesAction } from '../../state/pageActions';
import type { WithToken } from '../../state/refreshSession';
import type { Dispatch } from '../../state/StateContext';
import { failJob, printToJob, useOneShotLoad } from '../../views/useOneShotLoad';

/** How many conversation pages one load reads, and how many each one holds. */
const MAX_PAGES = 3;
const PAGE_SIZE = 40;

/** The window's inputs, handed to {@link fetchDirect} as one job. */
export type DirectJob = {
  readonly withToken: WithToken;
  /** The handle of the person to find a conversation with, as the window has it. */
  readonly target: string;
  readonly windowId: string;
  readonly signal: AbortSignal;
  readonly dispatch: Dispatch;
};

/** Say nothing has been said with the window's target yet, and close the load. */
function printNothing(job: DirectJob): void {
  printToJob(job, 'info', `No messages with @${job.target} yet. Type to start one.`);
  job.dispatch(loadAction(job.windowId, 'loaded', { exhausted: true }));
}

/** Whether {@link conversation} is the one-on-one with {@link wanted} that can show a word. */
function isWithTarget(conversation: Conversation, wanted: string): boolean {
  const [only] = conversation.accounts;
  return (
    conversation.accounts.length === 1 &&
    only?.acct.toLowerCase() === wanted &&
    conversation.last_status !== null
  );
}

/**
 * The most recent conversation that is the target's alone: pages at most
 * {@link MAX_PAGES} deep through the newest-first list, following the Link
 * cursors, and stops at the first match; null when none of them matches, and
 * {@link ApiError} when a page refuses.
 */
async function findConversation(
  job: DirectJob,
  wanted: string,
): Promise<Result<Conversation | null, ApiError>> {
  let cursor: PageCursor | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const request: PageRequest = { limit: PAGE_SIZE, ...(cursor === null ? {} : { cursor }) };
    const found = await job.withToken(
      async (session) => await listConversations(session, request, job.signal),
    );
    if (!found.ok) {
      return found;
    }
    const match = found.value.items.find((conversation) => isWithTarget(conversation, wanted));
    if (match !== undefined) {
      return ok(match);
    }
    if (found.value.links.next === null) {
      break;
    }
    cursor = found.value.links.next;
  }
  return ok(null);
}

/**
 * Show the conversation {@link last} leads: fetch its context and report the
 * whole thread as one newest-first `statuses` batch with an exhausted load,
 * then mark the conversation read. A half that refuses prints its
 * description and fails the load, and a job whose window closed while the
 * instance was thinking reports nothing at all.
 */
async function showConversation(
  job: DirectJob,
  conversation: Conversation,
  last: Status,
): Promise<void> {
  const around = await job.withToken(
    async (session) => await getContext(session, last.id, job.signal),
  );
  if (job.signal.aborted) {
    return;
  }
  if (!around.ok) {
    failJob(job, around.error);
    return;
  }
  const thread = [...around.value.ancestors, last, ...around.value.descendants];
  job.dispatch(statusesAction(job.windowId, thread.toReversed(), 'newer'));
  job.dispatch(loadAction(job.windowId, 'loaded', { exhausted: true }));
  await job.withToken(async (session) => await markConversationRead(session, conversation.id));
}

/**
 * Find the window's conversation with its target and report once: its thread
 * as one batch and an exhausted load, the window's own "no messages yet"
 * line, or the first failure printed into the window. A job whose signal is
 * already aborted reports nothing at all.
 */
export async function fetchDirect(job: DirectJob): Promise<void> {
  const found = await findConversation(job, job.target.toLowerCase());
  if (job.signal.aborted) {
    return;
  }
  if (!found.ok) {
    failJob(job, found.error);
    return;
  }
  const conversation = found.value;
  const last = conversation?.last_status ?? null;
  if (conversation === null || last === null) {
    printNothing(job);
    return;
  }
  await showConversation(job, conversation, last);
}

/**
 * Fill the DM window {@link windowId} once: while its buffer is idle and its
 * account can sign the fetch, load the conversation with its target through
 * the application's reducer and abort with the window. A window with no
 * target and no signed-in owner asks for nothing at all.
 */
export function useDirect(windowId: string): void {
  useOneShotLoad(windowId, fetchDirect);
}
