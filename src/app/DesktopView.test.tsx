/**
 * Tests for the desktop renderer (WFE-212): one pane draws its window's
 * content, row and column splits draw two panes each, the focus marker sits
 * on the focused pane, a pointer-down on the other pane moves focus, a split's
 * ratio sizes its halves, and an empty desktop shows its hint. Windows are of
 * a kind no feature implements, so each pane's log is named by its title and
 * nothing is fetched.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DesktopView } from './DesktopView';
import { initialAppState } from '../state/appState';
import type { AppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider, useAppDispatch } from '../state/StateContext';
import { windowId } from '../windows/model';
import type { WindowKind, WindowRef } from '../windows/model';
import { singlePane } from '../windows/splitTree';
import type { SplitDir } from '../windows/splitTree';

/** A window of a kind no shipped feature implements, named by `target`. */
function phantom(target: string): WindowRef {
  return { kind: 'phantom' as unknown as WindowKind, accountKey: null, target };
}

/** A fresh session with `phantom/a` open and shown, then `phantom/b` split in along `dir`. */
function splitState(dir: SplitDir): AppState {
  const opened = appReducer(initialAppState(), {
    type: 'windows',
    action: { type: 'open', ref: phantom('a'), title: 'phantom/a' },
  });
  const second = appReducer(opened, {
    type: 'windows',
    action: { type: 'open', ref: phantom('b'), title: 'phantom/b' },
  });
  const back = appReducer(second, {
    type: 'windows',
    action: { type: 'activate', id: windowId(phantom('a')) },
  });
  return appReducer(back, {
    type: 'layout',
    action: { type: 'split', dir, windowId: windowId(phantom('b')) },
  });
}

/** A button that moves the root split's ratio to 0.25. */
function RatioButton(): JSX.Element {
  const dispatch = useAppDispatch();
  return (
    <button
      type="button"
      onClick={() => {
        dispatch({ type: 'layout', action: { type: 'setRatio', path: [], ratio: 0.25 } });
      }}
    >
      shrink
    </button>
  );
}

/** Draws the desktop of `state`, with the ratio button beside it. */
function view(state: AppState): ReturnType<typeof render> {
  return render(
    <AppStateProvider initial={state}>
      <DesktopView />
      <RatioButton />
    </AppStateProvider>,
  );
}

describe(DesktopView, () => {
  it('draws the one pane of a fresh desktop with its window content', () => {
    view(initialAppState());

    const pane = screen.getByRole('region', { name: 'status' });

    expect(within(pane).getByRole('log', { name: 'status' })).toBeInTheDocument();
  });

  it('draws two panes with their own windows for a row split', () => {
    view(splitState('row'));

    expect(
      within(screen.getByRole('region', { name: 'phantom/a' })).getByRole('log', {
        name: 'phantom/a',
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'phantom/b' })).getByRole('log', {
        name: 'phantom/b',
      }),
    ).toBeInTheDocument();
  });

  it('draws two panes for a column split', () => {
    view(splitState('column'));

    expect(screen.getAllByRole('region')).toHaveLength(2);
  });

  it('marks only the focused pane', () => {
    view(splitState('row'));

    expect(screen.getByRole('region', { name: 'phantom/b' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('region', { name: 'phantom/a' })).not.toHaveAttribute('aria-current');
  });

  it('moves focus to a pane on pointer-down', () => {
    view(splitState('row'));

    fireEvent.pointerDown(screen.getByRole('log', { name: 'phantom/a' }));

    expect(screen.getByRole('region', { name: 'phantom/a' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('region', { name: 'phantom/b' })).not.toHaveAttribute('aria-current');
  });

  it('sizes the halves of a split by its ratio', () => {
    view(splitState('row'));

    expect(screen.getByRole('region', { name: 'phantom/a' }).closest('div')).toHaveStyle({
      flexGrow: '0.5',
    });

    fireEvent.click(screen.getByRole('button', { name: 'shrink' }));

    expect(screen.getByRole('region', { name: 'phantom/a' }).closest('div')).toHaveStyle({
      flexGrow: '0.25',
    });
    expect(screen.getByRole('region', { name: 'phantom/b' }).closest('div')).toHaveStyle({
      flexGrow: '0.75',
    });
  });

  it('draws a divider between the halves of a split and none for one pane', () => {
    view(initialAppState());

    expect(screen.queryByRole('separator')).not.toBeInTheDocument();

    view(splitState('row'));

    expect(screen.getByRole('separator', { name: 'Resize panes' })).toHaveAttribute(
      'aria-orientation',
      'vertical',
    );
  });

  it('draws a horizontal divider for a column split', () => {
    view(splitState('column'));

    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('resizes the split from the divider with the keyboard and resets it on double-click', () => {
    view(splitState('row'));
    const divider = screen.getByRole('separator');
    const first = screen.getByRole('region', { name: 'phantom/a' }).closest('div');

    fireEvent.keyDown(divider, { key: 'ArrowRight' });

    expect(divider).toHaveAttribute('aria-valuenow', '55');
    expect(first).toHaveStyle({ flexGrow: '0.55' });

    fireEvent.doubleClick(divider);

    expect(divider).toHaveAttribute('aria-valuenow', '50');
  });

  it('resizes the split as the divider is dragged', () => {
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    view(splitState('row'));
    const divider = screen.getByRole('separator');
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 1000,
      height: 500,
    } as DOMRect);

    fireEvent(divider, new MouseEvent('pointerdown', { bubbles: true }));
    fireEvent(divider, new MouseEvent('pointermove', { bubbles: true, clientX: 700 }));

    expect(divider).toHaveAttribute('aria-valuenow', '70');
  });

  it('resizes only the nested split whose divider is used', () => {
    const nested = appReducer(splitState('row'), {
      type: 'layout',
      action: { type: 'split', dir: 'column', windowId: windowId(phantom('a')) },
    });
    view(nested);
    const [outer, inner] = screen.getAllByRole('separator');

    fireEvent.keyDown(inner ?? document.body, { key: 'End' });

    expect(outer).toHaveAttribute('aria-valuenow', '50');
    expect(inner).toHaveAttribute('aria-valuenow', '90');
  });

  it('shows a hint on an empty desktop', () => {
    const empty = appReducer(initialAppState(), {
      type: 'layout',
      action: { type: 'goToDesktop', n: 2 },
    });
    view(empty);

    expect(screen.getByText('empty desktop — /vsplit, /split or Ctrl+B %')).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('draws nothing for a pane whose window is gone', () => {
    const state = initialAppState();
    const gone: AppState = {
      ...state,
      layout: {
        ...state.layout,
        desktops: [{ tree: singlePane('p1', 'ghost'), floats: [], focusedPaneId: 'p1' }],
      },
    };
    view(gone);

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});
