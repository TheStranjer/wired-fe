/**
 * Tests for the booted application: the heading, the placeholder scrollback
 * and the command line clearing after a submit.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe(App, () => {
  it('shows WIRED as the page heading', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WIRED');
  });

  it('shows the not-connected line in the status log', () => {
    render(<App />);

    const log = screen.getByRole('log', { name: 'status' });

    expect(within(log).getByText('WIRED // not connected')).toBeInTheDocument();
  });

  it('renders the command line', () => {
    render(<App />);

    expect(screen.getByRole('textbox', { name: 'Command line' })).toHaveValue('');
  });

  it('clears the command line after Enter', () => {
    render(<App />);

    const input = screen.getByRole('textbox', { name: 'Command line' });
    fireEvent.change(input, { target: { value: '/help' } });

    expect(input).toHaveValue('/help');

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('');
  });
});
