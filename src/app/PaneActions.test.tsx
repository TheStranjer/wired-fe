/**
 * Tests for the pane title-bar buttons (WFE-228): the ✕ of a pane closes that
 * pane, not the focused one, through the same command-line runner the post
 * cards use, and the window it showed stays open.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { DesktopView } from './DesktopView';
import { command as unsplit } from '../commands/defs/unsplit';
import { dispatchInput } from '../commands/dispatch';
import { buildRegistry } from '../commands/registry';
import { initialAppState } from '../state/appState';
import type { AppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider, useAppDispatch, useAppState } from '../state/StateContext';
import { fakeCommandContext } from '../test/commandContext';
import { PostActionsProvider } from '../views/PostActionsContext';
import type { PostActions } from '../views/PostActionsContext';
import { windowId } from '../windows/model';
import type { WindowKind, WindowRef } from '../windows/model';

/** A window of a kind no shipped feature implements, named by `target`. */
function phantom(target: string): WindowRef {
  return { kind: 'phantom' as unknown as WindowKind, accountKey: null, target };
}

/** `phantom/a` and `phantom/b` side by side, with b focused. */
function twoPanes(): AppState {
  const open = (state: AppState, target: string): AppState =>
    appReducer(state, {
      type: 'windows',
      action: { type: 'open', ref: phantom(target), title: `phantom/${target}` },
    });
  const both = open(open(initialAppState(), 'a'), 'b');
  const back = appReducer(both, {
    type: 'windows',
    action: { type: 'activate', id: windowId(phantom('a')) },
  });
  return appReducer(back, {
    type: 'layout',
    action: { type: 'split', dir: 'row', windowId: windowId(phantom('b')) },
  });
}

/** Lends the views a runner that runs lines through the real `/unsplit` over the live state. */
function Runner(props: { readonly children: JSX.Element }): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const registry = buildRegistry([unsplit]);
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
  return (
    <PostActionsProvider actions={actions}>
      {props.children}
      <output>{`windows: ${String(state.windows.windows.length)}`}</output>
    </PostActionsProvider>
  );
}

describe('PaneActions', () => {
  it('closes the pane whose button was clicked, not the focused one', async () => {
    render(
      <AppStateProvider initial={twoPanes()}>
        <Runner>
          <DesktopView />
        </Runner>
      </AppStateProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close pane phantom/a' }));

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'phantom/a' })).not.toBeInTheDocument();
    });

    expect(screen.getByRole('region', { name: 'phantom/b' })).toBeInTheDocument();
    expect(screen.getByText('windows: 3')).toBeInTheDocument();
  });

  it('does nothing without a command line to run the line', () => {
    render(
      <AppStateProvider initial={twoPanes()}>
        <DesktopView />
      </AppStateProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close pane phantom/a' }));

    expect(screen.getAllByRole('region')).toHaveLength(2);
  });
});
