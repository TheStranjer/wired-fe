/**
 * Tests for the pieces of a feed load the loader's own tests cannot reach: a
 * load whose window closed while the instances were thinking reports nothing
 * and keeps nothing, and the sources worth paging are the ones holding the
 * boundary back.
 */
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_FEED, type FeedJob, blockingRefs, runFeed } from './feedLoad';
import type { FeedCursorState } from '../../state/feedItem';
import { sourceKey } from '../../state/feedMerge';
import { A_HOME, B_HOME, C_LOCAL, post } from '../../test/feedItems';
import { A_ACCOUNT, feedState } from '../../test/feedWindow';

/** A job over lain's account whose signal has already fired. */
function abortedJob(): { readonly job: FeedJob; readonly dispatch: ReturnType<typeof vi.fn> } {
  const dispatch = vi.fn();
  const state = feedState([]);
  const job: FeedJob = {
    windowId: 'feed:-:f1',
    signal: AbortSignal.abort(),
    dispatch,
    refresh: { refresher: null, dispatch, getState: () => state },
    accounts: [A_ACCOUNT],
    read: () => EMPTY_FEED,
    write: vi.fn(),
  };
  return { job, dispatch };
}

describe(runFeed, () => {
  it('reports nothing and keeps nothing for a load that was cancelled', async () => {
    const { job, dispatch } = abortedJob();
    const source = { accountKey: A_ACCOUNT.key, source: 'home' } as const;

    await runFeed(job, () => [source]);

    expect(dispatch).not.toHaveBeenCalled();
    expect(job.write).not.toHaveBeenCalled();
  });
});

describe(blockingRefs, () => {
  const open = { cursor: { max_id: 'c' }, exhausted: false };
  const items = [post('a1', 50, A_HOME), post('a2', 30, A_HOME), post('b1', 45, B_HOME)];
  const cursors: FeedCursorState = {
    [sourceKey(A_HOME)]: open,
    [sourceKey(B_HOME)]: open,
    [sourceKey(C_LOCAL)]: open,
  };

  it('keeps the sources of the feed that hold the boundary back', () => {
    expect(blockingRefs([A_HOME, B_HOME, C_LOCAL], { items, cursors })).toStrictEqual([B_HOME]);
  });

  it('leaves out a blocking source the feed does not have', () => {
    expect(blockingRefs([A_HOME, C_LOCAL], { items, cursors })).toStrictEqual([]);
  });
});
