/**
 * Tests for the side pane's nick list (WFE-133): the heading over a named
 * list, one clickable nick per account in list order, a click reporting its
 * own account back, and the bare heading over an empty list.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NickList } from './NickList';
import type { ListedAccount } from './NickList';

const ALICE: ListedAccount = {
  id: '2',
  acct: 'alice@m.example',
  fullHandle: '@alice@m.example',
  self: false,
};

const ME: ListedAccount = {
  id: '1',
  acct: 'lain',
  fullHandle: '@lain@wired.example',
  self: true,
};

describe(NickList, () => {
  it('shows the heading over a list named for it', () => {
    render(<NickList title="recently here" accounts={[ALICE]} onSelect={vi.fn()} />);

    expect(screen.getByText('recently here')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'recently here' })).toBeInTheDocument();
  });

  it('renders one nick per account, in list order', () => {
    render(<NickList title="in thread" accounts={[ALICE, ME]} onSelect={vi.fn()} />);

    const names = within(screen.getByRole('list'))
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));

    expect(names).toStrictEqual(['@alice@m.example', '@lain@wired.example']);
  });

  it('reports the clicked account back', () => {
    const onSelect = vi.fn();
    render(<NickList title="in conversation" accounts={[ALICE, ME]} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: '@lain@wired.example' }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(ME);
  });

  it('shows just the heading when no one is on the list', () => {
    render(<NickList title="recently here" accounts={[]} onSelect={vi.fn()} />);

    expect(screen.getByText('recently here')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
