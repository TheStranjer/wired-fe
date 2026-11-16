/**
 * Tests for the search window kind's definition and component: it
 * self-registers the `search` kind, topics its window as the search it is —
 * and plainly when there is nothing to search — takes no posts, and its
 * component fetches the answer (one served document, src/test/searchWindow)
 * into a log region named after the window's title, sections above posts. An
 * unopened window names itself plainly and asks for nothing.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import type { AppState } from '../../state/appState';
import { AppStateProvider } from '../../state/StateContext';
import {
  SEARCH_QUERY,
  SEARCH_REF,
  SEARCH_WINDOW,
  searchState,
  serveSearch,
} from '../../test/searchWindow';
import { type WindowState, activeWindow } from '../../windows/model';

/** The same window with nothing to target, the way a bare ref opens it. */
function targetless(): WindowState {
  return {
    id: 'search-targetless',
    ref: { ...SEARCH_REF, target: null },
    title: 'search/-',
    unread: 0,
    highlight: false,
  };
}

/** Render {@link state} with the kind's own component for its window. */
function renderSearch(state: AppState, windowId: string): void {
  const { Component } = windowKind;

  render(
    <AppStateProvider initial={state}>
      <Component windowId={windowId} />
    </AppStateProvider>,
  );
}

describe('the search window kind', () => {
  it('is the definition for the search kind, and it takes no posts', () => {
    expect(windowKind.kind).toBe('search');
    expect(windowKind.Component).toBeTypeOf('function');
    expect(windowKind.onPost).toBeUndefined();
  });

  it('topics its window as the search it is', () => {
    const state = searchState();

    expect(windowKind.topic(activeWindow(state.windows), state)).toBe(`search: ${SEARCH_QUERY}`);
  });

  it('topics a window with nothing to search plainly', () => {
    expect(windowKind.topic(targetless(), searchState())).toBe('search');
  });

  it('shows the loaded answer under the window title, sections above posts', async () => {
    serveSearch();

    renderSearch(searchState(), SEARCH_WINDOW);

    const log = await screen.findByRole('log', { name: 'search/lain' });
    await screen.findByText('is anyone there?');

    expect(log).toHaveTextContent('Accounts:');
    expect(log).toHaveTextContent('#lain (/join #lain)');
  });

  it('names an unopened window’s log region plainly and fetches nothing', () => {
    // No handlers are registered: any request would fail this test.
    renderSearch(searchState(), 'search:never:opened');

    expect(screen.getByRole('log', { name: 'search' })).toBeEmptyDOMElement();
  });
});
