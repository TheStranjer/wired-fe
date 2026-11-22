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

import { type SearchResults, search, shouldResolve } from '../../api/endpoints/search';
import type { Account } from '../../api/schemas/account';
import type { Tag } from '../../api/schemas/tag';
import type { ApiSession } from '../../api/session';
import { loadAction, statusesAction } from '../../state/pageActions';
import type { Dispatch } from '../../state/StateContext';
import { type OneShotJob, failJob, printToJob, useOneShotLoad } from '../../views/useOneShotLoad';

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
  printToJob(job, 'info', 'Accounts:');
  for (const account of accounts) {
    printToJob(job, 'info', accountLine(account));
  }
}

/** The `Tags:` section; silent when the search found none. */
function printTags(job: SearchJob, tags: readonly Tag[]): void {
  if (tags.length === 0) {
    return;
  }
  printToJob(job, 'info', 'Tags:');
  for (const tag of tags) {
    printToJob(job, 'info', tagLine(tag));
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
    printToJob(job, 'info', `No results for "${job.query}"`);
  } else {
    printAccounts(job, results.accounts);
    printTags(job, results.hashtags);
    if (results.statuses.length !== 0) {
      job.dispatch(statusesAction(job.windowId, results.statuses, 'newer'));
    }
  }
  job.dispatch(loadAction(job.windowId, 'loaded', { exhausted: true }));
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
  failJob(job, found.error);
}

/** The search window answers its target with one {@link fetchSearch}. */
async function runSearch(job: OneShotJob): Promise<void> {
  await fetchSearch({ ...job, query: job.target });
}

/**
 * Fill the search window {@link windowId} once: while its buffer is idle and
 * its account can sign the search, run the search for its target through the
 * application's reducer and abort with the window. A window with no target
 * and no signed-in owner asks for nothing at all.
 */
export function useSearch(windowId: string): void {
  useOneShotLoad(windowId, runSearch);
}
