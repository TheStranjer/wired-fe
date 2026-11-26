/**
 * Tests that the search slice's text follows the language in use (decision
 * 19): the topic line and the section headings it prints are read from the
 * catalog.
 */
import { describe, expect, it, vi } from 'vitest';

import { fetchSearch } from './useSearch';
import { windowKind } from './windowKind';
import { installFakeLocale } from '../../test/i18n';
import { SEARCH_QUERY, SEARCH_WINDOW, searchState, serveSearch } from '../../test/searchWindow';
import { activeWindow } from '../../windows/model';

describe('the search slice in another language', () => {
  it('words its topic line from the catalog', () => {
    installFakeLocale({ features: { search: { topic_query: 'XX {query}' } } });
    const state = searchState();

    expect(windowKind.topic(activeWindow(state.windows), state)).toBe(`XX ${SEARCH_QUERY}`);
  });

  it('words the line for no results from the catalog', async () => {
    installFakeLocale({ features: { search: { no_results: 'XX none for {query}' } } });
    serveSearch({ results: { accounts: [], statuses: [], hashtags: [] } });
    const dispatch = vi.fn();

    await fetchSearch({
      withToken: async (call) => await call({ origin: 'https://wired.example', token: 'x' }),
      query: SEARCH_QUERY,
      windowId: SEARCH_WINDOW,
      signal: new AbortController().signal,
      dispatch,
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ text: `XX none for ${SEARCH_QUERY}` }),
    );
  });
});
