/**
 * Tests for the `Existing window…` row of the pane menus (WFE-270): it swaps
 * the menu for a list of the other open windows, led by `‹ Back`, keeps the
 * menu keyboard behaviour, and runs `/<command> win N` without prefilling.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { JSX } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { DesktopView } from './DesktopView';
import { AppStateProvider } from '../state/StateContext';
import { twoPanes } from '../test/phantomPanes';
import type { PostActionLine } from '../ui/postActionTypes';
import { PostActionsProvider } from '../views/PostActionsContext';

/** Every line the buttons ran or filled, in order. */
const lines: PostActionLine[] = [];

/** The desktop of two panes, a and b, over a runner that records the lines. */
function Desk(): JSX.Element {
  return (
    <AppStateProvider initial={twoPanes()}>
      <PostActionsProvider
        actions={{
          linesFor: () => ({}),
          run: (line) => {
            lines.push(line);
          },
        }}
      >
        <DesktopView />
      </PostActionsProvider>
    </AppStateProvider>
  );
}

/** The button called {@link name} on pane a (the first). */
function buttonOf(name: string): HTMLElement {
  const [button] = screen.getAllByRole('button', { name });
  if (button === undefined) {
    throw new Error(`no ${name} button`);
  }
  return button;
}

/** Opens the menu of the button called {@link name} and chooses `Existing window…`. */
function openPicker(name: string): void {
  fireEvent.click(buttonOf(name));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Existing window…' }));
}

describe('the Existing window… row', () => {
  beforeEach(() => {
    lines.length = 0;
  });

  it('lists the other windows after ‹ Back, with focus on the first row', () => {
    render(<Desk />);

    openPicker('Split side by side');

    const labels = screen.getAllByRole('menuitem').map((item) => item.textContent);

    expect(labels).toStrictEqual(['‹ Back', '1 · status', '3 · phantom/b']);
    expect(screen.getByRole('menuitem', { name: '‹ Back' })).toHaveFocus();
    expect(lines).toStrictEqual([]);
  });

  it('runs /vsplit win N with arrows and Enter, without prefilling', async () => {
    render(<Desk />);
    openPicker('Split side by side');

    fireEvent.keyDown(screen.getByRole('menuitem', { name: '‹ Back' }), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('menuitem', { name: '1 · status' }), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('menuitem', { name: '3 · phantom/b' }), { key: 'Enter' });

    await waitFor(() => {
      expect(lines).toStrictEqual([{ line: '/vsplit win 3', prefill: false }]);
    });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(buttonOf('Split side by side')).toHaveFocus();
  });

  it('runs /split win N from the stacked button and /float win N from the pop-out', async () => {
    render(<Desk />);

    openPicker('Split stacked');
    fireEvent.click(screen.getByRole('menuitem', { name: '1 · status' }));
    openPicker('Pop out');
    fireEvent.click(screen.getByRole('menuitem', { name: '3 · phantom/b' }));

    await waitFor(() => {
      expect(lines).toStrictEqual([
        { line: '/split win 1', prefill: false },
        { line: '/float win 3', prefill: false },
      ]);
    });
  });

  it('returns to the top level on ‹ Back, focused on Existing window…', () => {
    render(<Desk />);
    openPicker('Split side by side');

    fireEvent.click(screen.getByRole('menuitem', { name: '‹ Back' }));

    const menu = screen.getByRole('menu', { name: 'Split side by side' });

    expect(within(menu).getByRole('menuitem', { name: 'Same window' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Existing window…' })).toHaveFocus();
  });

  it('closes on Escape, focuses the button, and reopens at the top level', () => {
    render(<Desk />);
    openPicker('Split side by side');

    fireEvent.keyDown(screen.getByRole('menuitem', { name: '‹ Back' }), { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(buttonOf('Split side by side')).toHaveFocus();

    fireEvent.click(buttonOf('Split side by side'));

    expect(screen.getByRole('menuitem', { name: 'Same window' })).toBeInTheDocument();
  });

  it('closes from the picker when the button is clicked again', () => {
    render(<Desk />);
    openPicker('Split side by side');

    fireEvent.click(buttonOf('Split side by side'));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
