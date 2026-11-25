/**
 * Tests for the desktop on a mobile device class (WFE-247): one pane is drawn
 * full size without dividers, floats join the cycle without drag or resize
 * handles, the switcher steps and jumps, an empty or ghost desktop shows the
 * hint, and the desktop class still draws every pane. Windows are of a kind
 * no feature implements, so nothing is fetched.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DesktopView } from './DesktopView';
import type { DeviceClass } from '../lib/deviceClass';
import { initialAppState } from '../state/appState';
import type { AppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { windowId } from '../windows/model';
import type { WindowKind, WindowRef } from '../windows/model';
import { singlePane } from '../windows/splitTree';

const HINT = 'empty desktop — /vsplit, /split or Ctrl+B %';

/** A window of a kind no shipped feature implements, named by `target`. */
function phantom(target: string): WindowRef {
  return { kind: 'phantom' as unknown as WindowKind, accountKey: null, target };
}

/** Status in the tree and phantom/a split in beside it, then floats f1 (phantom/b) and f2 (phantom/c). */
function crowded(): AppState {
  const opened = ['a', 'b', 'c'].reduce(
    (state, target) =>
      appReducer(state, {
        type: 'windows',
        action: { type: 'open', ref: phantom(target), title: `phantom/${target}` },
      }),
    initialAppState(),
  );
  const [status] = opened.windows.windows;
  const shown = appReducer(opened, {
    type: 'windows',
    action: { type: 'activate', id: status?.id ?? '' },
  });
  const split = appReducer(shown, {
    type: 'layout',
    action: { type: 'split', dir: 'row', windowId: windowId(phantom('a')) },
  });
  const [desktop] = split.layout.desktops;
  const rect = { x: 0.25, y: 0.25, w: 0.25, h: 0.5 };
  return {
    ...split,
    layout: {
      ...split.layout,
      desktops: [
        {
          tree: desktop?.tree ?? null,
          floats: [
            { paneId: 'f1', windowId: windowId(phantom('b')), rect },
            { paneId: 'f2', windowId: windowId(phantom('c')), rect },
          ],
          focusedPaneId: 'p1',
        },
      ],
    },
  };
}

/** Draws the desktop of `state` as a `deviceClass` device. */
function show(state: AppState, deviceClass: DeviceClass = 'mobile'): void {
  render(
    <AppStateProvider initial={state}>
      <DesktopView deviceClass={deviceClass} />
    </AppStateProvider>,
  );
}

/** The title of the one region on screen. */
function shownTitle(): string {
  return screen.getByRole('region').getAttribute('aria-label') ?? '';
}

describe('DesktopView on mobile', () => {
  it('draws only the focused pane, without dividers', () => {
    show(crowded());

    expect(screen.getAllByRole('region')).toHaveLength(1);
    expect(shownTitle()).toBe('status');
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('draws floats as plain panes without a resize grip', () => {
    show(crowded());

    fireEvent.click(screen.getByRole('button', { name: 'Next pane' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next pane' }));

    expect(shownTitle()).toBe('phantom/b');
    expect(screen.queryByRole('button', { name: 'Resize window' })).not.toBeInTheDocument();
  });

  it('steps to the next pane through the tree, then the floats, wrapping', () => {
    show(crowded());
    const next = screen.getByRole('button', { name: 'Next pane' });

    expect(screen.getByRole('button', { name: 'Switch pane' })).toHaveTextContent('1/4');

    fireEvent.click(next);

    expect(shownTitle()).toBe('phantom/a');

    fireEvent.click(next);
    fireEvent.click(next);

    expect(shownTitle()).toBe('phantom/c');
    expect(screen.getByRole('button', { name: 'Switch pane' })).toHaveTextContent('4/4');

    fireEvent.click(next);

    expect(shownTitle()).toBe('status');
  });

  it('steps to the previous pane, wrapping to the last float', () => {
    show(crowded());

    fireEvent.click(screen.getByRole('button', { name: 'Previous pane' }));

    expect(shownTitle()).toBe('phantom/c');
  });

  it('jumps to a pane picked from the menu, ticking the current one', () => {
    show(crowded());

    fireEvent.click(screen.getByRole('button', { name: 'Switch pane' }));

    expect(screen.getByRole('menuitemcheckbox', { name: 'status' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemcheckbox', { name: 'phantom/b' })).toHaveAttribute(
      'aria-checked',
      'false',
    );

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'phantom/b' }));

    expect(shownTitle()).toBe('phantom/b');
  });

  it('keeps the close button beside the switcher', () => {
    show(crowded());

    expect(screen.getByRole('button', { name: 'Close pane status' })).toBeInTheDocument();
  });

  it('shows the hint on an empty desktop', () => {
    show(appReducer(initialAppState(), { type: 'layout', action: { type: 'goToDesktop', n: 2 } }));

    expect(screen.getByText(HINT)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next pane' })).not.toBeInTheDocument();
  });

  it('skips a pane whose window is gone', () => {
    const state = initialAppState();
    show({
      ...state,
      layout: {
        ...state.layout,
        desktops: [{ tree: singlePane('p1', 'ghost'), floats: [], focusedPaneId: 'p1' }],
      },
    });

    expect(screen.getByText(HINT)).toBeInTheDocument();
  });
});

describe('DesktopView on desktop', () => {
  it('draws every tree pane and divider, and no switcher', () => {
    show(crowded(), 'desktop');

    expect(screen.getAllByRole('region').length).toBeGreaterThan(2);
    expect(screen.getByRole('separator')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next pane' })).not.toBeInTheDocument();
  });
});
