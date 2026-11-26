/**
 * Tests for the status line: the groups, the desktop entries and the hidden
 * window entries, their accessible names, aria-current and clicking an entry.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StatusLine } from './StatusLine';
import type { StatusLineProps } from './StatusLine';
import type { StatusLineDesktop, StatusLineWindow } from './statusLineTypes';

const NOOP = (): undefined => undefined;

/** Three desktops: the second on screen with unread, the third holding a highlight. */
const DESKTOPS: readonly StatusLineDesktop[] = [
  { number: 1, unread: 0, highlight: false, active: false },
  { number: 2, unread: 12, highlight: false, active: true },
  { number: 3, unread: 1, highlight: true, active: false },
];

/** One window with unread posts, one waiting for a reply. */
const WINDOWS: readonly StatusLineWindow[] = [
  { number: 3, title: 'home', unread: 3, highlight: false },
  { number: 7, title: 'dm/bob', unread: 0, highlight: true },
];

const BASE_PROPS: StatusLineProps = {
  clock: '23:07',
  accountLabel: '@lain@wired.example',
  desktops: DESKTOPS,
  windows: WINDOWS,
  mode: 'insert',
  pendingKeys: null,
  onSelectDesktop: NOOP,
  onCloseDesktop: NOOP,
  onSelectWindow: NOOP,
  onShowMedia: NOOP,
};

const FULL_LINE = '[23:07] [@lain@wired.example] [1] [2*:12]× [3:1] │ 3:home(3) 7:dm/bob* [INS]';

/** Renders the status line with the base props changed, and returns the row. */
function renderStatusLine(overrides: Partial<StatusLineProps>): HTMLElement {
  const { container } = render(<StatusLine {...BASE_PROPS} {...overrides} />);
  return container;
}

describe(StatusLine, () => {
  it('renders clock, account, desktops, hidden windows and mode as one line', () => {
    const line = renderStatusLine({});

    expect(line.textContent).toBe(FULL_LINE);
    expect(screen.getAllByRole('button')).toHaveLength(6);
  });

  it('labels every desktop with its number and state', () => {
    renderStatusLine({});

    expect(screen.getByRole('button', { name: 'Desktop 1' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Desktop 2, active, 12 unread' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Desktop 3, 1 unread, highlighted' }),
    ).toBeInTheDocument();
  });

  it('labels every hidden window with its number, title and state', () => {
    renderStatusLine({});

    expect(screen.getByRole('button', { name: 'Window 3: home, 3 unread' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Window 7: dm/bob, highlighted' }),
    ).toBeInTheDocument();
  });

  it('shows a dash for the account and NAV in navigation mode', () => {
    const line = renderStatusLine({ accountLabel: null, mode: 'navigation' });

    expect(line.textContent).toBe('[23:07] [-] [1] [2*:12]× [3:1] │ 3:home(3) 7:dm/bob* [NAV]');
  });

  it('shows no separator when no window has activity', () => {
    const line = renderStatusLine({ windows: [] });

    expect(line.textContent).toBe('[23:07] [@lain@wired.example] [1] [2*:12]× [3:1] [INS]');
  });

  it('shows one bare active desktop for the default layout', () => {
    const line = renderStatusLine({
      desktops: [{ number: 1, unread: 0, highlight: false, active: true }],
      windows: [],
    });

    expect(line.textContent).toBe('[23:07] [@lain@wired.example] [1*] [INS]');
  });

  it('calls onSelectDesktop with the number of the clicked desktop', () => {
    const onSelectDesktop = vi.fn<(number: number) => void>();
    renderStatusLine({ onSelectDesktop });

    fireEvent.click(screen.getByRole('button', { name: 'Desktop 3, 1 unread, highlighted' }));

    expect(onSelectDesktop).toHaveBeenCalledWith(3);
  });

  it('calls onSelectWindow with the number of the clicked window', () => {
    const onSelectWindow = vi.fn<(number: number) => void>();
    renderStatusLine({ onSelectWindow });

    fireEvent.click(screen.getByRole('button', { name: 'Window 7: dm/bob, highlighted' }));

    expect(onSelectWindow).toHaveBeenCalledWith(7);
  });

  it('marks only the active desktop with aria-current', () => {
    renderStatusLine({});

    expect(screen.getByRole('button', { name: 'Desktop 2, active, 12 unread' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Desktop 1' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Window 3: home, 3 unread' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('shows pending media as its own group before the mode', () => {
    const line = renderStatusLine({ pendingMedia: 2 });

    expect(line.textContent).toBe(
      '[23:07] [@lain@wired.example] [1] [2*:12]× [3:1] │ 3:home(3) 7:dm/bob* [+2 media] [INS]',
    );
  });

  it('makes the pending media group a button that asks to show them', () => {
    const onShowMedia = vi.fn();
    renderStatusLine({ pendingMedia: 2, onShowMedia });

    fireEvent.click(screen.getByRole('button', { name: '2 media waiting, show' }));

    expect(onShowMedia).toHaveBeenCalledTimes(1);
  });

  it('shows a pending key prefix next to the mode', () => {
    const line = renderStatusLine({ pendingKeys: 'Ctrl+B' });

    expect(line.textContent).toBe(
      '[23:07] [@lain@wired.example] [1] [2*:12]× [3:1] │ 3:home(3) 7:dm/bob* [Ctrl+B …] [INS]',
    );
  });

  it('shows ⇅ with an accessible name while a push is pending', () => {
    const line = renderStatusLine({ sync: 'pending' });

    expect(line.textContent).toBe(
      '[23:07] [@lain@wired.example] [1] [2*:12]× [3:1] │ 3:home(3) 7:dm/bob* ⇅ [INS]',
    );
    expect(screen.getByRole('img', { name: 'Sync pending' })).toHaveTextContent('⇅');
  });

  it('shows ⇅! with an accessible name after a sync error', () => {
    renderStatusLine({ sync: 'error' });

    expect(screen.getByRole('img', { name: 'Sync failed' })).toHaveTextContent('⇅!');
  });

  it.each<Partial<StatusLineProps>>([{}, { sync: null }])(
    'shows no sync marker for %j',
    (props) => {
      const line = renderStatusLine(props);

      expect(line.textContent).toBe(FULL_LINE);
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    },
  );

  it('shows no media group while nothing waits', () => {
    const line = renderStatusLine({ pendingMedia: 0 });

    expect(line.textContent).toBe(FULL_LINE);
  });
});
