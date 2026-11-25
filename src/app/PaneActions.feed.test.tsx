/**
 * Tests for the `✎` button of a feed window's title bar (WFE-242): it runs
 * `/feed edit` for its own pane, so the feed's editor takes the pane's place,
 * and only a feed window whose feed is saved has one. The editor has no
 * display menu: it shows no posts.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { DesktopView } from './DesktopView';
import { command as feed } from '../commands/defs/feed';
import { dispatchInput } from '../commands/dispatch';
import { buildRegistry } from '../commands/registry';
import { initialAppState } from '../state/appState';
import type { AppState } from '../state/appState';
import { feedWindowOpen } from '../state/feedWindow';
import { appReducer } from '../state/reducer';
import { AppStateProvider, useAppDispatch, useAppState } from '../state/StateContext';
import { fakeCommandContext } from '../test/commandContext';
import { PostActionsProvider } from '../views/PostActionsContext';
import type { PostActions } from '../views/PostActionsContext';
import type { WindowKind } from '../windows/model';

const MAIN = { id: 'f1', name: 'main', sources: [] };

/** A session with the feed `main` saved and its window shown in the only pane. */
function mainOpen(): AppState {
  const saved = appReducer(initialAppState(), { type: 'settings', settings: { feeds: [MAIN] } });
  return appReducer(saved, { type: 'windows', action: feedWindowOpen(MAIN) });
}

/** Runs lines through the real `/feed` over the live state. */
function Runner(props: { readonly children: JSX.Element }): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const registry = buildRegistry([feed]);
  if (!registry.ok) {
    throw new Error(registry.error);
  }
  const runRef = useRef<PostActions['run']>(() => undefined);
  useEffect(() => {
    runRef.current = ({ line }) => {
      const context = fakeCommandContext({
        state,
        windows: state.windows,
        dispatch,
        dispatchWindows: (action) => {
          dispatch({ type: 'windows', action });
        },
        registry: registry.value,
      });
      void dispatchInput(line, context, async () => {
        await Promise.resolve();
      });
    };
  });
  const actions: PostActions = {
    linesFor: () => ({}),
    run: (line) => {
      runRef.current(line);
    },
  };
  return <PostActionsProvider actions={actions}>{props.children}</PostActionsProvider>;
}

/** {@link initial} drawn as a desktop whose buttons run real commands. */
function renderDesk(initial: AppState): void {
  render(
    <AppStateProvider initial={initial}>
      <Runner>
        <DesktopView />
      </Runner>
    </AppStateProvider>,
  );
}

describe('the edit feed button', () => {
  it('puts the feed editor in the pane of the feed window, which has no display menu', async () => {
    renderDesk(mainOpen());

    expect(screen.getByRole('button', { name: 'Display options for ~main' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit feed ~main' }));

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'edit ~main' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('region', { name: '~main' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Display options/u })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit feed/u })).not.toBeInTheDocument();
  });

  it('is not on a feed window whose feed is not saved', () => {
    const state = appReducer(initialAppState(), {
      type: 'windows',
      action: feedWindowOpen({ id: 'gone', name: 'gone', sources: [] }),
    });

    renderDesk(state);

    expect(screen.getByRole('region', { name: '~gone' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit feed/u })).not.toBeInTheDocument();
  });

  it('is not on a window that is not a feed, even one with no target', () => {
    const state = appReducer(initialAppState(), {
      type: 'windows',
      action: {
        type: 'open',
        ref: { kind: 'phantom' as unknown as WindowKind, accountKey: null, target: null },
        title: 'phantom',
      },
    });

    renderDesk(state);

    expect(screen.getByRole('region', { name: 'phantom' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit feed/u })).not.toBeInTheDocument();
  });
});
