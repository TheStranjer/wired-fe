/**
 * Tests for the float layer (WFE-222): floats sit at their fractional
 * rectangles in array order, the title bar drags and the corner grip resizes
 * by fractions of the layer, a pointer-down anywhere focuses and raises, and
 * a float whose window is gone draws nothing. Windows are of a kind no
 * feature implements, so nothing is fetched.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DesktopView } from './DesktopView';
import { initialAppState } from '../state/appState';
import type { AppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import type { FloatRect } from '../windows/floats';
import { windowId } from '../windows/model';
import type { WindowKind, WindowRef } from '../windows/model';
import { singlePane } from '../windows/splitTree';

/** A window of a kind no shipped feature implements, named by `target`. */
function phantom(target: string): WindowRef {
  return { kind: 'phantom' as unknown as WindowKind, accountKey: null, target };
}

const RECT: FloatRect = { x: 0.25, y: 0.25, w: 0.25, h: 0.5 };

/** The status pane in the tree, with floats f1 (phantom/a) below f2 (phantom/b). */
function floatingState(second: string = windowId(phantom('b'))): AppState {
  const opened = ['a', 'b'].reduce(
    (state, target) =>
      appReducer(state, {
        type: 'windows',
        action: { type: 'open', ref: phantom(target), title: `phantom/${target}` },
      }),
    initialAppState(),
  );
  const [status] = opened.windows.windows;
  return {
    ...opened,
    layout: {
      ...opened.layout,
      desktops: [
        {
          tree: singlePane('p1', status?.id ?? ''),
          floats: [
            { paneId: 'f1', windowId: windowId(phantom('a')), rect: RECT },
            { paneId: 'f2', windowId: second, rect: { ...RECT, x: 0.5 } },
          ],
          focusedPaneId: 'p1',
        },
      ],
    },
  };
}

/** The element that places a float: its frame's parent. */
function placement(name: string): HTMLElement {
  const box = screen.getByRole('region', { name }).closest('div');
  if (box === null) {
    throw new Error(`no placement for ${name}`);
  }
  return box;
}

/** The float's left, top, width and height custom properties. */
function placed(name: string): string[] {
  const box = placement(name);
  return ['x', 'y', 'w', 'h'].map((key) => box.style.getPropertyValue(`--float-${key}`));
}

describe('FloatLayer', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 1000, 500),
    );
  });

  it('places each float from its fractional rectangle', () => {
    render(
      <AppStateProvider initial={floatingState()}>
        <DesktopView />
      </AppStateProvider>,
    );

    expect(placed('phantom/a')).toStrictEqual(['25%', '25%', '25%', '50%']);
    expect(placed('phantom/b')).toStrictEqual(['50%', '25%', '25%', '50%']);
  });

  it('stacks floats in array order above the tree', () => {
    render(
      <AppStateProvider initial={floatingState()}>
        <DesktopView />
      </AppStateProvider>,
    );

    expect(
      screen.getAllByRole('region').map((frame) => frame.getAttribute('aria-label')),
    ).toStrictEqual(['status', 'phantom/a', 'phantom/b']);
  });

  it('drags a float by its title bar, in fractions of the layer', () => {
    render(
      <AppStateProvider initial={floatingState()}>
        <DesktopView />
      </AppStateProvider>,
    );

    fireEvent.pointerDown(screen.getByText(/phantom\/a/), { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(document, { clientX: 350, clientY: 225 });
    fireEvent.pointerUp(document);

    expect(placed('phantom/a')).toStrictEqual(['50%', '50%', '25%', '50%']);
  });

  it('keeps a dragged float inside the viewport', () => {
    render(
      <AppStateProvider initial={floatingState()}>
        <DesktopView />
      </AppStateProvider>,
    );

    fireEvent.pointerDown(screen.getByText(/phantom\/a/), { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(document, { clientX: 5000, clientY: -5000 });

    expect(placed('phantom/a')).toStrictEqual(['75%', '0%', '25%', '50%']);
  });

  it('resizes a float from the corner grip', () => {
    render(
      <AppStateProvider initial={floatingState()}>
        <DesktopView />
      </AppStateProvider>,
    );

    const grips = screen.getAllByRole('button', { name: 'Resize window' });
    fireEvent.pointerDown(grips[0] ?? document.body, { clientX: 500, clientY: 250 });
    fireEvent.pointerMove(document, { clientX: 750, clientY: 125 });

    expect(placed('phantom/a')).toStrictEqual(['25%', '25%', '50%', '25%']);
  });

  it('focuses and raises the float whose content is pressed', () => {
    render(
      <AppStateProvider initial={floatingState()}>
        <DesktopView />
      </AppStateProvider>,
    );

    fireEvent.pointerDown(screen.getByRole('log', { name: 'phantom/a' }));

    expect(screen.getByRole('region', { name: 'phantom/a' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(
      screen.getAllByRole('region').map((frame) => frame.getAttribute('aria-label')),
    ).toStrictEqual(['status', 'phantom/b', 'phantom/a']);
  });

  it('focuses the float whose grip is pressed', () => {
    render(
      <AppStateProvider initial={floatingState()}>
        <DesktopView />
      </AppStateProvider>,
    );

    const grips = screen.getAllByRole('button', { name: 'Resize window' });
    fireEvent.pointerDown(grips[0] ?? document.body);

    expect(screen.getByRole('region', { name: 'phantom/a' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('draws nothing for a float whose window is gone', () => {
    render(
      <AppStateProvider initial={floatingState('ghost')}>
        <DesktopView />
      </AppStateProvider>,
    );

    expect(screen.getAllByRole('button', { name: 'Resize window' })).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'ghost' })).not.toBeInTheDocument();
  });
});
