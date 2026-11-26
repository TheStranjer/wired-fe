/**
 * Tests for the search window kind's definition and component: it
 * self-registers the `search` kind, topics its window as the search it is —
 * and plainly when there is nothing to search — posts as the account without
 * entering the results, and its component fetches the answer (one served document, src/test/searchWindow)
 * into a log region named after the window's title, sections above posts. An
 * unopened window names itself plainly and asks for nothing.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import type { AppState } from '../../state/appState';
import { AppStateProvider } from '../../state/StateContext';
import { runKindPost } from '../../test/kindPost';
import {
  SEARCH_QUERY,
  SEARCH_REF,
  SEARCH_WINDOW,
  searchState,
  serveSearch,
} from '../../test/searchWindow';
import { type WindowState, activeWindow } from '../../windows/model';

const ORIGIN = 'https://wired.example';

/** The same window with nothing to target, the way a bare ref opens it. */
function targetless(): WindowState {
  return {
    id: 'search-targetless',
    ref: { ...SEARCH_REF, target: null },
    title: 'search/-',
    unread: 0,
    highlight: false,
    display: {},
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
  it('is the definition for the search kind, and it takes posts', () => {
    expect(windowKind.kind).toBe('search');
    expect(windowKind.Component).toBeTypeOf('function');
    expect(windowKind.onPost).toBeTypeOf('function');
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

  it('posts as its window’s account, not into the buffer, and confirms it', async () => {
    const state = searchState();
    const win = activeWindow(state.windows);

    const run = await runKindPost(windowKind, { state, win, origin: ORIGIN }, 'sup');

    expect(run.result).toBeNull();
    expect(run.bodies).toStrictEqual([{ status: 'sup', visibility: 'public' }]);
    expect(run.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'statuses' }));
    expect(run.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'print', text: 'posted as @lain@wired.example' }),
    );
  });

  it('resolves the API error when the post is refused', async () => {
    const state = searchState();
    const win = activeWindow(state.windows);

    const run = await runKindPost(windowKind, { state, win, origin: ORIGIN, refused: true }, 'sup');

    expect(run.result).toBe('HTTP 422: Text is too long');
  });
});
