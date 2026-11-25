/**
 * Tests for docking a float by dragging (WFE-231): moving a float's title bar
 * with Shift held over a tree pane announces the dock edge and, on release,
 * docks the float there; without Shift the float only moves. Windows are of a
 * kind no feature implements, so nothing is fetched.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DesktopView } from './DesktopView';
import { initialAppState } from '../state/appState';
import type { AppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { windowId } from '../windows/model';
import type { WindowKind, WindowRef } from '../windows/model';
import { singlePane } from '../windows/splitTree';
import { splitPane } from '../windows/splitTreeOps';

/** A window of a kind no shipped feature implements, named by `target`. */
function phantom(target: string): WindowRef {
  return { kind: 'phantom' as unknown as WindowKind, accountKey: null, target };
}

/** `row(p1:status p2:phantom/a)` in the tree and the float f1 showing phantom/b. */
function dockableState(): AppState {
  const opened = ['a', 'b'].reduce(
    (state, target) =>
      appReducer(state, {
        type: 'windows',
        action: { type: 'open', ref: phantom(target), title: `phantom/${target}` },
      }),
    initialAppState(),
  );
  const [status] = opened.windows.windows;
  const tree = splitPane(
    singlePane('p1', status?.id ?? ''),
    'p1',
    'row',
    'p2',
    windowId(phantom('a')),
  );
  const rect = { x: 0.1, y: 0.1, w: 0.3, h: 0.3 };
  return {
    ...opened,
    layout: {
      ...opened.layout,
      desktops: [
        {
          tree,
          floats: [{ paneId: 'f1', windowId: windowId(phantom('b')), rect }],
          focusedPaneId: 'p1',
        },
      ],
    },
  };
}

/** Starts dragging the float's title bar. */
function grab(): void {
  fireEvent.pointerDown(screen.getByText(/phantom\/b/), { clientX: 100, clientY: 100 });
}

describe('docking a float by dragging', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 1000, 500),
    );
  });

  it('announces the edge of the pane under a Shift-drag', () => {
    render(
      <AppStateProvider initial={dockableState()}>
        <DesktopView />
      </AppStateProvider>,
    );

    grab();
    fireEvent.pointerMove(document, { clientX: 900, clientY: 250, shiftKey: true });

    expect(screen.getByText('Dock right of #phantom/a')).toBeInTheDocument();
  });

  it('announces nothing when the Shift-drag is over no pane', () => {
    render(
      <AppStateProvider initial={dockableState()}>
        <DesktopView />
      </AppStateProvider>,
    );

    grab();
    fireEvent.pointerMove(document, { clientX: 900, clientY: 250, shiftKey: true });
    fireEvent.pointerMove(document, { clientX: 5000, clientY: 250, shiftKey: true });

    expect(screen.queryByText(/^Dock /)).not.toBeInTheDocument();
  });

  it('docks the float into the tree on a Shift release', () => {
    render(
      <AppStateProvider initial={dockableState()}>
        <DesktopView />
      </AppStateProvider>,
    );

    grab();
    fireEvent.pointerMove(document, { clientX: 100, clientY: 250, shiftKey: true });
    fireEvent.pointerUp(document, { clientX: 100, clientY: 250, shiftKey: true });

    expect(screen.queryByRole('button', { name: 'Resize window' })).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('region').map((frame) => frame.getAttribute('aria-label')),
    ).toStrictEqual(['phantom/b', 'status', 'phantom/a']);
    expect(screen.queryByText(/^Dock /)).not.toBeInTheDocument();
  });

  it('only moves the float without Shift', () => {
    render(
      <AppStateProvider initial={dockableState()}>
        <DesktopView />
      </AppStateProvider>,
    );

    grab();
    fireEvent.pointerMove(document, { clientX: 900, clientY: 250 });
    fireEvent.pointerUp(document, { clientX: 900, clientY: 250 });

    expect(screen.getByRole('button', { name: 'Resize window' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('region').map((frame) => frame.getAttribute('aria-label')),
    ).toStrictEqual(['status', 'phantom/a', 'phantom/b']);
  });
});
