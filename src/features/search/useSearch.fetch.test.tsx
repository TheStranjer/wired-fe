/**
 * Tests for `fetchSearch`, the search job the hook runs: the whole document
 * prints its `Accounts:` and `Tags:` sections in order — a nameless account
 * shows its username — and hands the posts to the window as one `newer` batch
 * in API order, then closes the load exhausted. A document with only posts
 * prints no section headers; one with nothing at all prints the window's own
 * `No results` line and shows no posts. A handle query is sent with
 * `resolve=true`, plain text without it, and both ask for twenty of each
 * resource. A failed search prints its description and fails the load, and a
 * job whose window closed while the instance was thinking reports nothing at
 * all. The served document and its request params come from
 * src/test/searchWindow.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { fetchSearch, type SearchJob } from './useSearch';
import type { Dispatch } from '../../state/StateContext';
import {
  FOUND,
  SEARCH_QUERY,
  SEARCH_SESSION,
  SEARCH_TARGETLESS,
  SEARCH_WINDOW,
  type ServeSearch,
  serveSearch,
} from '../../test/searchWindow';
import { withSession } from '../../test/withToken';

/** The printed section, in the order a full document says it. */
const SECTIONS: readonly unknown[] = [
  { print: 'Accounts:' },
  { print: '  @lain@wired.example — Lain Iwakura  (/whois @lain@wired.example)' },
  { print: '  @void@other.example — void  (/whois @void@other.example)' },
  { print: 'Tags:' },
  { print: '  #lain  (/join #lain)' },
];

/** The closed load every answered search ends with, exhausted: one answer. */
const LOADED: unknown = { type: 'load', windowId: SEARCH_WINDOW, load: 'loaded', exhausted: true };

/** The post batch a document with {@link FOUND}'s statuses reports. */
const POSTS: readonly unknown[] = [
  { type: 'statuses', windowId: SEARCH_WINDOW, statuses: FOUND.statuses, where: 'newer' },
];

/** A job searching for {@link SEARCH_QUERY} into a search window, aborted when told. */
function jobFor(dispatch: Dispatch, signal = new AbortController().signal): SearchJob {
  return {
    withToken: withSession(SEARCH_SESSION),
    query: SEARCH_QUERY,
    windowId: SEARCH_WINDOW,
    signal,
    dispatch,
  };
}

/** The actions a recorded dispatch saw, prints pared down to their text. */
function dispatched(dispatch: Mock<Dispatch>): readonly unknown[] {
  return dispatch.mock.calls.map(([action]) =>
    action.type === 'print' ? { print: action.text } : action,
  );
}

/** Search for {@link query} against {@link serve} and report the window's actions. */
async function runWith(
  query: string,
  serve: ServeSearch,
): Promise<{ readonly asked: URLSearchParams[]; readonly calls: readonly unknown[] }> {
  const asked = serveSearch(serve);
  const dispatch = vi.fn<Dispatch>();

  await fetchSearch({ ...jobFor(dispatch), query });

  return { asked, calls: dispatched(dispatch) };
}

describe(fetchSearch, () => {
  it('prints both sections, shows the posts and closes the load exhausted', async () => {
    const { calls } = await runWith(SEARCH_QUERY, {});

    expect(calls).toStrictEqual([...SECTIONS, ...POSTS, LOADED]);
  });

  it('asks for twenty of each resource', async () => {
    const { asked } = await runWith(SEARCH_QUERY, {});

    expect(asked).toHaveLength(1);
    expect([...(asked[0]?.entries() ?? [])]).toStrictEqual([
      ['q', SEARCH_QUERY],
      ['limit', '20'],
    ]);
  });

  it('sends a handle query to be resolved and plain text not to be', async () => {
    const plain = await runWith('two words', {});
    const remote = await runWith('@lain@wired.example', {});

    expect(plain.asked[0]?.get('resolve')).toBeNull();
    expect(remote.asked[0]?.get('resolve')).toBe('true');
  });

  it('shows posts with no accounts or tags printed no section headers', async () => {
    const { calls } = await runWith(SEARCH_QUERY, {
      results: { accounts: [], statuses: FOUND.statuses, hashtags: [] },
    });

    expect(calls).toStrictEqual([...POSTS, LOADED]);
  });

  it('prints accounts without tags and tags without accounts', async () => {
    const onlyAccounts = await runWith(SEARCH_QUERY, {
      results: { accounts: FOUND.accounts, statuses: [], hashtags: [] },
    });
    const onlyTags = await runWith(SEARCH_QUERY, {
      results: { accounts: [], statuses: [], hashtags: FOUND.hashtags },
    });

    expect(onlyAccounts.calls).toStrictEqual([SECTIONS[0], SECTIONS[1], SECTIONS[2], LOADED]);
    expect(onlyTags.calls).toStrictEqual([SECTIONS[3], SECTIONS[4], LOADED]);
  });

  it('says there are no results and shows nothing when the document is empty', async () => {
    const { calls } = await runWith(SEARCH_QUERY, {
      results: { accounts: [], statuses: [], hashtags: [] },
    });

    expect(calls).toStrictEqual([{ print: `No results for "${SEARCH_QUERY}"` }, LOADED]);
  });

  it('prints a failed search once and fails the load', async () => {
    const { calls } = await runWith(SEARCH_QUERY, { fail: true });

    expect(calls).toStrictEqual([
      { print: 'HTTP 500: Boom' },
      { type: 'load', windowId: SEARCH_WINDOW, load: 'error' },
    ]);
  });

  it('reports nothing once the window it answers has closed', async () => {
    serveSearch();
    const controller = new AbortController();
    controller.abort();
    const dispatch = vi.fn<Dispatch>();

    await fetchSearch({ ...jobFor(dispatch, controller.signal), windowId: SEARCH_TARGETLESS });

    expect(dispatch).not.toHaveBeenCalled();
  });
});
