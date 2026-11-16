/**
 * Tests for the search hook: while the window is idle its buffer moves to a
 * loading search — one served search over MSW (src/test/searchWindow) — and
 * the scrollback ends up reading the printed sections above the found posts
 * under an exhausted load. A failed search prints its description and fails
 * the load. No target, no account, or a buffer that is not idle mean no
 * request at all. The job's own dispatch sequence is
 * useSearch.fetch.test.tsx.
 */
import { render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { useSearch } from './useSearch';
import type { AppState } from '../../state/appState';
import { bufferFor } from '../../state/selectors';
import { AppStateProvider, useAppState } from '../../state/StateContext';
import {
  SEARCH_TARGETLESS,
  SEARCH_WINDOW,
  searchState,
  serveSearch,
  withTargetless,
} from '../../test/searchWindow';
import { unsigned } from '../../test/threadWindow';
import { BufferView } from '../../views/BufferView';

/** The window's own load flags, spelled out beside its scrollback. */
function Probe(props: { readonly windowId: string }): JSX.Element {
  const { load, exhausted } = bufferFor(useAppState(), props.windowId);

  return <span>{`load:${load} exhausted:${String(exhausted)}`}</span>;
}

/** Runs the hook under test and renders the window's lines. */
function Loader(props: { readonly windowId: string }): JSX.Element {
  useSearch(props.windowId);

  return <BufferView label="search" windowId={props.windowId} />;
}

/** {@link hook} over {@link state}, its window's scrollback along for the prints. */
function Host(props: { readonly windowId: string; readonly state: AppState }): JSX.Element {
  return (
    <AppStateProvider initial={props.state}>
      <Probe windowId={props.windowId} />
      <Loader windowId={props.windowId} />
    </AppStateProvider>
  );
}

/** The index of {@link marker} in the search window's scrollback text. */
function indexOfMarker(marker: string): number {
  return screen.getByRole('log', { name: 'search' }).textContent.indexOf(marker);
}

describe(useSearch, () => {
  it('prints the sections above the posts and closes the load exhausted', async () => {
    serveSearch();

    render(<Host windowId={SEARCH_WINDOW} state={searchState()} />);

    await screen.findByText('load:loaded exhausted:true');

    expect(screen.getByRole('log', { name: 'search' })).toHaveTextContent(
      '@lain@wired.example — Lain Iwakura (/whois @lain@wired.example)',
    );

    const places = [
      'Accounts:',
      '@void@other.example',
      'Tags:',
      '#lain',
      'is anyone there?',
      'present time',
    ].map(indexOfMarker);

    expect(places).toStrictEqual([...places].sort((a, b) => a - b));
    expect(places[0]).toBeGreaterThanOrEqual(0);
  });

  it('says there are no results when the document is empty', async () => {
    serveSearch({ results: { accounts: [], statuses: [], hashtags: [] } });

    render(<Host windowId={SEARCH_WINDOW} state={searchState()} />);

    await screen.findByText('load:loaded exhausted:true');

    expect(screen.getByRole('log', { name: 'search' })).toHaveTextContent('No results for "lain"');
  });

  it('prints a failed search into the window', async () => {
    serveSearch({ fail: true });

    render(<Host windowId={SEARCH_WINDOW} state={searchState()} />);

    await screen.findByText('load:error exhausted:false');

    expect(screen.getByRole('log', { name: 'search' })).toHaveTextContent('HTTP 500: Boom');
  });

  it('fetches nothing when the buffer is not idle', async () => {
    // No handlers are registered: any request would fail this test.
    render(<Host windowId={SEARCH_WINDOW} state={searchState(true)} />);

    await screen.findByText('load:loaded exhausted:false');

    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('fetches nothing when the window has no target', async () => {
    render(<Host windowId={SEARCH_TARGETLESS} state={withTargetless(searchState())} />);

    await screen.findByText('load:idle exhausted:false');

    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('fetches nothing when the window has no account', async () => {
    render(<Host windowId={SEARCH_WINDOW} state={unsigned(searchState())} />);

    await screen.findByText('load:idle exhausted:false');

    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });
});
