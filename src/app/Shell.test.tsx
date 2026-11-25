/**
 * Tests for the shell layout: each slot renders inside the right landmark.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Shell } from './Shell';
import type { ShellProps } from './Shell';

/** One marker per slot, to see where the shell places it. */
const SLOTS: ShellProps = {
  topic: <span>topic-slot</span>,
  scrollback: <span>scrollback-slot</span>,
  statusLine: <span>status-line-slot</span>,
  input: <span>input-slot</span>,
};

describe(Shell, () => {
  it('renders the topic slot in the banner', () => {
    render(<Shell {...SLOTS} />);

    expect(within(screen.getByRole('banner')).getByText('topic-slot')).toBeInTheDocument();
  });

  it('renders the scrollback slot in the main region', () => {
    render(<Shell {...SLOTS} />);

    expect(within(screen.getByRole('main')).getByText('scrollback-slot')).toBeInTheDocument();
  });

  it('names the main region after the scrollback label', () => {
    render(<Shell {...SLOTS} scrollbackLabel="Desktop 2" />);

    expect(screen.getByRole('main', { name: 'Desktop 2' })).toBeInTheDocument();
  });

  it('renders the status line and input slots in the footer', () => {
    render(<Shell {...SLOTS} />);

    const footer = screen.getByRole('contentinfo');

    expect(within(footer).getByText('status-line-slot')).toBeInTheDocument();
    expect(within(footer).getByText('input-slot')).toBeInTheDocument();
  });
});
