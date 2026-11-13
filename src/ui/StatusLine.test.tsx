/**
 * Tests for the status line: the four groups, the window entries, their
 * accessible names, aria-current and clicking an entry.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StatusLine } from './StatusLine';
import type { StatusLineProps, StatusLineWindow } from './StatusLine';

const NOOP = (): undefined => undefined;

/** One plain window, one with unread posts, one waiting for a reply. */
const WINDOWS: readonly StatusLineWindow[] = [
  { number: 1, title: 'status', unread: 0, highlight: false, active: true },
  { number: 2, title: 'home', unread: 3, highlight: false, active: false },
  { number: 3, title: 'dm/bob', unread: 0, highlight: true, active: false },
];

const BASE_PROPS: StatusLineProps = {
  clock: '23:07',
  accountLabel: '@lain@wired.example',
  windows: WINDOWS,
  mode: 'insert',
  onSelectWindow: NOOP,
};

const FULL_LINE = '[23:07] [@lain@wired.example] [1:status 2:home(3) 3:dm/bob*] [INS]';

/** Renders the status line with the base props changed, and returns the row. */
function renderStatusLine(overrides: Partial<StatusLineProps>): HTMLElement {
  const { container } = render(<StatusLine {...BASE_PROPS} {...overrides} />);
  return container;
}

describe(StatusLine, () => {
  it('renders clock, account, windows and mode as one bracketed line', () => {
    const line = renderStatusLine({});

    expect(line.textContent).toBe(FULL_LINE);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('labels every entry with its number, title and state', () => {
    renderStatusLine({});

    expect(screen.getByRole('button', { name: 'Window 1: status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Window 2: home, 3 unread' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Window 3: dm/bob, highlighted' }),
    ).toBeInTheDocument();
  });

  it('shows a dash for the account and NAV in navigation mode', () => {
    const line = renderStatusLine({ accountLabel: null, mode: 'navigation' });

    expect(line.textContent).toBe('[23:07] [-] [1:status 2:home(3) 3:dm/bob*] [NAV]');
  });

  it('renders empty brackets when there are no windows', () => {
    const line = renderStatusLine({ windows: [] });

    expect(line.textContent).toBe('[23:07] [@lain@wired.example] [] [INS]');
  });

  it('calls onSelectWindow with the number of the clicked entry', () => {
    const onSelectWindow = vi.fn<(number: number) => void>();
    renderStatusLine({ onSelectWindow });

    fireEvent.click(screen.getByRole('button', { name: 'Window 2: home, 3 unread' }));

    expect(onSelectWindow).toHaveBeenCalledWith(2);
  });

  it('marks only the active entry with aria-current', () => {
    renderStatusLine({});

    expect(screen.getByRole('button', { name: 'Window 1: status' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Window 2: home, 3 unread' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(
      screen.getByRole('button', { name: 'Window 3: dm/bob, highlighted' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('lists every state of a window that is active, unread and highlighted', () => {
    const line = renderStatusLine({
      windows: [{ number: 4, title: 'dm/eop', unread: 2, highlight: true, active: true }],
    });

    const entry = screen.getByRole('button', { name: 'Window 4: dm/eop, 2 unread, highlighted' });

    expect(line.textContent).toBe('[23:07] [@lain@wired.example] [4:dm/eop(2)*] [INS]');
    expect(entry).toHaveAttribute('aria-current', 'true');
  });
});
