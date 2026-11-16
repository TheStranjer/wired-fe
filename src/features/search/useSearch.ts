/**
 * The one-shot load of one search window (WFE-109, AGENTS.md "Windows, like IRC
 * buffers"): the combined v2 search the window's target names, run once
 * through the window's own account with twenty of each resource asked for and
 * `shouldResolve` deciding whether the query looks like a remote reference
 * worth resolving. The answer prints itself into the window's scrollback the
 * way an IRC search answers: an `Accounts:` section naming each account with
 * the `/whois` that opens it, a `Tags:` section naming each hashtag with the
 * `/join` that joins it, then the matching posts as post lines. A section with
 * nothing in it says nothing; a document with nothing at all prints one
 * `No results` line. Either way the load ends exhausted — one search is one
 * answer, there is no older to page to. A failed fetch prints its description
 * the way the page loaders do, and a fetch whose window closed while the
 * instance was thinking reports nothing at all.
 */

import { useEffect, useRef } from 'react';

import { type SearchResults, search, shouldResolve } from '../../api/endpoints/search';
import { type ApiError, describeApiError } from '../../api/errors';
import type { Account } from '../../api/schemas/account';
import type { Tag } from '../../api/schemas/tag';
import type { ApiSession } from '../../api/session';
import type { LineLevel } from '../../state/buffer';
import { accountByKey, bufferFor, windowAccountKey } from '../../state/selectors';
import type { Dispatch } from '../../state/StateContext';
import { useAppDispatch, useAppState } from '../../state/StateContext';

/** How many of each resource one search asks the instance for. */
const SEARCH_LIMIT = 20;

/** The window's inputs, handed to {@link fetchSearch} as one job. */
export type SearchJob = {
  readonly session: ApiSession;
  /** The query to search for, as the window carries it. */
  readonly query: string;
  readonly windowId: string;
  readonly signal: AbortSignal;
  readonly dispatch: Dispatch;
};

/** Print {@link text} at {@link level} into the window's scrollback. */
function printText(job: SearchJob, level: LineLevel, text: string): void {
  job.dispatch({ type: 'print', windowId: job.windowId, date: new Date(), level, text });
}

/** Print why the search never answered, once, and fail the load. */
function printFailure(job: SearchJob, error: ApiError): void {
  printText(job, 'error', describeApiError(error));
  job.dispatch({ type: 'load', windowId: job.windowId, load: 'error' });
}

/** The account's name as the line shows it: its display name, or its username. */
function nameOf(account: Account): string {
  return account.display_name === '' ? account.username : account.display_name;
}

/** One account's line: its handle, its name, and the /whois that opens it. */
function accountLine(account: Account): string {
  return `  @${account.acct} — ${nameOf(account)}  (/whois @${account.acct})`;
}

/** One tag's line: its name and the /join that joins it. */
function tagLine(tag: Tag): string {
  return `  #${tag.name}  (/join #${tag.name})`;
}

/** The `Accounts:` section; silent when the search found none. */
function printAccounts(job: SearchJob, accounts: readonly Account[]): void {
  if (accounts.length === 0) {
    return;
  }
  printText(job, 'info', 'Accounts:');
  for (const account of accounts) {
    printText(job, 'info', accountLine(account));
  }
}

/** The `Tags:` section; silent when the search found none. */
function printTags(job: SearchJob, tags: readonly Tag[]): void {
  if (tags.length === 0) {
    return;
  }
  printText(job, 'info', 'Tags:');
  for (const tag of tags) {
    printText(job, 'info', tagLine(tag));
  }
}

/** Whether {@link results} holds nothing at all. */
function isNothing(results: SearchResults): boolean {
  return (
    results.accounts.length === 0 && results.statuses.length === 0 && results.hashtags.length === 0
  );
}

/**
 * Report {@link results}: the printed sections, then the posts as post lines —
 * or one `No results` line when the document holds nothing — and close the
 * load exhausted: a search answers once.
 */
function report(job: SearchJob, results: SearchResults): void {
  if (isNothing(results)) {
    printText(job, 'info', `No results for "${job.query}"`);
  } else {
    printAccounts(job, results.accounts);
    printTags(job, results.hashtags);
    if (results.statuses.length !== 0) {
      job.dispatch({
        type: 'statuses',
        windowId: job.windowId,
        statuses: results.statuses,
        where: 'newer',
      });
    }
  }
  job.dispatch({ type: 'load', windowId: job.windowId, load: 'loaded', exhausted: true });
}

/**
 * Run one combined search for {@link SearchJob.query} and report once: the
 * answer's sections and post lines, or its `No results` line, or the printed
 * failure. A job whose signal is already aborted reports nothing at all.
 */
export async function fetchSearch(job: SearchJob): Promise<void> {
  const found = await search(
    job.session,
    job.query,
    { resolve: shouldResolve(job.query), limit: SEARCH_LIMIT },
    job.signal,
  );
  if (job.signal.aborted) {
    return;
  }
  if (found.ok) {
    report(job, found.value);
    return;
  }
  printFailure(job, found.error);
}

/**
 * Fill the search window {@link windowId} once: while its buffer is idle and
 * its account can sign the search, run the search for its target through the
 * application's reducer and abort with the window. A window with no target
 * and no signed-in owner asks for nothing at all.
 */
export function useSearch(windowId: string): void {
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
    void fetchSearch({
      session: { origin, token },
      query: target,
      windowId,
      signal: controller.signal,
      dispatch,
    });
  }, [load, target, origin, token, windowId, dispatch]);
}
