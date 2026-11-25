/**
 * One load of a feed window (decision 14): ask a set of its sources for a page
 * in parallel, each as its own account, and hand what arrives to the window's
 * buffer, which folds it into everything loaded so far with the merge engine
 * and shows the part of it that paging has made safe to show. A source that
 * fails prints one client message into the window and is skipped — it counts as
 * exhausted from then on — while the rest still load. The window's items and
 * per-source paging state live in its buffer, where the streams also deliver
 * to them, so a page and a live post never overwrite each other.
 */

import { type SourcePage, fetchSourcePage } from './fetchSource';
import type { StoredAccount } from '../../accounts/accountStore';
import { describeApiError } from '../../api/errors';
import type { PageRequest } from '../../api/page';
import { printAction } from '../../state/appState';
import type { FeedData } from '../../state/feedItem';
import { blockingSources, sourceKey } from '../../state/feedMerge';
import type { FeedSourceRef } from '../../state/feeds';
import { feedAction, loadAction } from '../../state/pageActions';
import { type RefreshDeps, withFreshToken } from '../../state/refreshSession';
import type { Dispatch } from '../../state/StateContext';

/** How many items one source page asks for. */
const FEED_PAGE_SIZE = 40;

/** One load: the window, how it reaches each account, and how it reads what the window has loaded. */
export type FeedJob = {
  readonly windowId: string;
  readonly signal: AbortSignal;
  readonly dispatch: Dispatch;
  readonly refresh: RefreshDeps;
  /** The signed-in accounts, to name a source in a message. */
  readonly accounts: readonly StoredAccount[];
  /** The window's loaded data as the app state holds it now. */
  readonly read: () => FeedData;
};

/** Which sources a load asks, chosen from the data loaded so far. */
export type ChooseSources = (data: FeedData) => readonly FeedSourceRef[];

/** What asking one source came to. */
type Outcome = {
  readonly ref: FeedSourceRef;
  readonly result: SourcePage;
};

/** The sources of {@link sources} that hold the boundary of {@link data} back, the ones worth paging. */
export function blockingRefs(
  sources: readonly FeedSourceRef[],
  data: FeedData,
): readonly FeedSourceRef[] {
  const keys = new Set(blockingSources(data.items, data.cursors));
  return sources.filter((ref) => keys.has(sourceKey(ref)));
}

/** A source as a message names it: `@me@host:home`, or the account key when it is not signed in. */
function sourceName(accounts: readonly StoredAccount[], ref: FeedSourceRef): string {
  const handle = accounts.find((account) => account.key === ref.accountKey)?.handle;
  return `@${handle ?? ref.accountKey}:${ref.source}`;
}

/** Ask one source for the page after {@link cursor} (the newest page for none), as its account. */
async function askSource(job: FeedJob, ref: FeedSourceRef, data: FeedData): Promise<Outcome> {
  const cursor = data.cursors[sourceKey(ref)]?.cursor ?? null;
  const page: PageRequest = { limit: FEED_PAGE_SIZE, ...(cursor === null ? {} : { cursor }) };
  const result = await withFreshToken(
    job.refresh,
    ref.accountKey,
    async (session) => await fetchSourcePage(ref, { session, page, signal: job.signal }),
  );
  return { ref, result };
}

/** What {@link outcomes} brought: the items to merge in, and each asked source's paging moved on (a failed one is exhausted). */
function arrivals(outcomes: readonly Outcome[]): FeedData {
  const items = outcomes.flatMap(({ result }) => (result.ok ? result.value.items : []));
  const moved = outcomes.map(({ ref, result }) => {
    const next = result.ok ? result.value.links.next : null;
    return [sourceKey(ref), { cursor: next, exhausted: next === null }] as const;
  });
  return { items, cursors: Object.fromEntries(moved) };
}

/** Print one client message for every source that failed. */
function reportFailures(job: FeedJob, outcomes: readonly Outcome[]): void {
  for (const { ref, result } of outcomes) {
    if (!result.ok) {
      const text = `${sourceName(job.accounts, ref)} failed: ${describeApiError(result.error)}`;
      job.dispatch(printAction(job.windowId, 'error', text));
    }
  }
}

/**
 * Load the sources {@link choose} picks from the window's data: ask them all at
 * once, merge what comes, print the failures, show the visible part of the
 * stream and close the load — exhausted once no source has an older page. A job
 * whose window closed while the instances were thinking reports nothing.
 */
export async function runFeed(job: FeedJob, choose: ChooseSources): Promise<void> {
  const before = job.read();
  const outcomes = await Promise.all(
    choose(before).map(async (ref) => await askSource(job, ref, before)),
  );
  if (job.signal.aborted) {
    return;
  }
  const { items, cursors } = arrivals(outcomes);
  job.dispatch(feedAction(job.windowId, items, cursors));
  reportFailures(job, outcomes);
  const paging = Object.values({ ...job.read().cursors, ...cursors });
  job.dispatch(
    loadAction(job.windowId, 'loaded', { exhausted: paging.every((cursor) => cursor.exhausted) }),
  );
}
