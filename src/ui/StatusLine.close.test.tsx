/**
 * Tests for closing desktops from the status line (WFE-273): the `×` after the
 * active desktop, middle-click on any desktop, and the title that says so.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StatusLine } from './StatusLine';
import type { StatusLineProps } from './StatusLine';
import type { StatusLineDesktop } from './statusLineTypes';

const NOOP = (): undefined => undefined;

/** Three desktops: the second on screen with unread, the third holding a highlight. */
const DESKTOPS: readonly StatusLineDesktop[] = [
  { number: 1, unread: 0, highlight: false, active: false },
  { number: 2, unread: 12, highlight: false, active: true },
  { number: 3, unread: 1, highlight: true, active: false },
];

const BASE_PROPS: StatusLineProps = {
  clock: '23:07',
  accountLabel: '@lain@wired.example',
  desktops: DESKTOPS,
  windows: [],
  mode: 'insert',
  pendingKeys: null,
  onSelectDesktop: NOOP,
  onCloseDesktop: NOOP,
  onSelectWindow: NOOP,
};

/** Renders the status line with the base props changed. */
function renderStatusLine(overrides: Partial<StatusLineProps>): void {
  render(<StatusLine {...BASE_PROPS} {...overrides} />);
}

describe('StatusLine closing desktops', () => {
  it('puts a × right after the active desktop only, named for that desktop, in tab order', () => {
    renderStatusLine({});

    const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'));
    const close = screen.getByRole('button', { name: 'Close desktop 2' });
    close.focus();

    expect(names).toStrictEqual([
      'Desktop 1',
      'Desktop 2, active, 12 unread',
      'Close desktop 2',
      'Desktop 3, 1 unread, highlighted',
    ]);
    expect(close).toHaveTextContent('×');
    expect(close).toHaveFocus();
  });

  it('shows no × while there is only one desktop', () => {
    renderStatusLine({
      desktops: [{ number: 1, unread: 0, highlight: false, active: true }],
    });

    expect(screen.queryByRole('button', { name: /^Close desktop/u })).not.toBeInTheDocument();
  });

  it('calls onCloseDesktop with the active number when the × is clicked', () => {
    const onCloseDesktop = vi.fn<(number: number) => void>();
    renderStatusLine({ onCloseDesktop });

    fireEvent.click(screen.getByRole('button', { name: 'Close desktop 2' }));

    expect(onCloseDesktop).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('closes the desktop that is middle-clicked, and only on the middle button', () => {
    const onCloseDesktop = vi.fn<(number: number) => void>();
    const onSelectDesktop = vi.fn<(number: number) => void>();
    renderStatusLine({ onCloseDesktop, onSelectDesktop });
    const third = screen.getByRole('button', { name: 'Desktop 3, 1 unread, highlighted' });

    fireEvent(third, new MouseEvent('auxclick', { bubbles: true, button: 2 }));

    expect(onCloseDesktop).not.toHaveBeenCalled();

    fireEvent(third, new MouseEvent('auxclick', { bubbles: true, button: 1 }));

    expect(onCloseDesktop).toHaveBeenCalledExactlyOnceWith(3);
    expect(onSelectDesktop).not.toHaveBeenCalled();
  });

  it('says in the title of a desktop how to switch and close it', () => {
    renderStatusLine({});

    expect(screen.getByRole('button', { name: 'Desktop 1' })).toHaveAttribute(
      'title',
      'Desktop 1: click to switch, middle-click to close',
    );
  });
});
