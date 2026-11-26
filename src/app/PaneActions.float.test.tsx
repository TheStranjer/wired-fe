/**
 * Tests for the float buttons of a pane's title bar (WFE-230, WFE-299): `⧉`
 * floats the clicked pane (not the focused one) and has no menu, `⊞` docks a
 * float back into the tree, and a float has no split or float buttons.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { DesktopView } from './DesktopView';
import { command as dock } from '../commands/defs/dock';
import { command as float } from '../commands/defs/float';
import { dispatchInput } from '../commands/dispatch';
import { buildRegistry } from '../commands/registry';
import type { AppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider, useAppDispatch, useAppState } from '../state/StateContext';
import { fakeCommandContext } from '../test/commandContext';
import { twoPanes } from '../test/phantomPanes';
import { PostActionsProvider } from '../views/PostActionsContext';
import type { PostActions } from '../views/PostActionsContext';
import { activeDesktop } from '../windows/desktops';

/** Every line the buttons ran or filled, in order. */
const lines: string[] = [];

/** Runs lines through the real `/float` and `/dock` over the live state; records every line. */
function Runner(props: { readonly children: JSX.Element }): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const registry = buildRegistry([float, dock]);
  if (!registry.ok) {
    throw new Error(registry.error);
  }
  const runRef = useRef<PostActions['run']>(() => undefined);
  useEffect(() => {
    runRef.current = ({ line, prefill }) => {
      lines.push(line);
      if (prefill) {
        return;
      }
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
  const { tree, floats } = activeDesktop(state.layout);
  return (
    <PostActionsProvider actions={actions}>
      {props.children}
      <output aria-label="tree">{tree === null ? 'empty' : JSON.stringify(tree)}</output>
      <output aria-label="floats">{floats.map((one) => one.windowId).join(',')}</output>
    </PostActionsProvider>
  );
}

/** Renders the desktop of {@link initial} inside a running {@link Runner}. */
function renderDesk(initial: AppState): void {
  render(
    <AppStateProvider initial={initial}>
      <Runner>
        <DesktopView />
      </Runner>
    </AppStateProvider>,
  );
}

/** Two panes, a and b, with a torn off into a float. */
function floatedA(): AppState {
  const focused = appReducer(twoPanes(), {
    type: 'layout',
    action: { type: 'focusPane', paneId: 'p1' },
  });
  return appReducer(focused, { type: 'layout', action: { type: 'float' } });
}

describe('the float button', () => {
  beforeEach(() => {
    lines.length = 0;
  });

  it('floats the clicked pane even when another pane is focused', async () => {
    renderDesk(twoPanes());

    fireEvent.click(screen.getByRole('button', { name: 'Float phantom/a' }));

    await waitFor(() => {
      expect(screen.getByLabelText('floats')).toHaveTextContent('phantom:-:a');
    });

    expect(lines).toStrictEqual(['/float']);
  });

  it('is a plain button on every tree pane: no menu, and no pop-out menu button', () => {
    renderDesk(twoPanes());

    const floater = screen.getByRole('button', { name: 'Float phantom/a' });

    expect(floater).not.toHaveAttribute('aria-haspopup');
    expect(screen.getAllByRole('button', { name: /^Float / })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Pop out' })).not.toBeInTheDocument();
    expect(screen.queryByText('⧉▾')).not.toBeInTheDocument();
  });
});

describe('the dock button', () => {
  beforeEach(() => {
    lines.length = 0;
  });

  it('docks the float into the tree', async () => {
    renderDesk(floatedA());

    expect(screen.getByLabelText('floats')).toHaveTextContent('phantom:-:a');

    fireEvent.click(screen.getByRole('button', { name: 'Dock phantom/a' }));

    await waitFor(() => {
      expect(screen.getByLabelText('floats')).toBeEmptyDOMElement();
    });

    expect(screen.getByLabelText('tree')).toHaveTextContent('phantom:-:a');
    expect(lines).toStrictEqual(['/dock']);
  });

  it('shows no split or float buttons on a float, only on the tree pane', () => {
    renderDesk(floatedA());

    expect(screen.getAllByRole('button', { name: 'Split side by side' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Split stacked' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^Float / })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^Dock / })).toHaveLength(1);
  });
});
