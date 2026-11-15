/**
 * Tests for the booted application: the visually hidden heading, and the
 * live shell the state provider mounts beneath it — the status window's log
 * and topic, the window list, and the command line.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe(App, () => {
  it('shows WIRED as the page heading', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WIRED');
  });

  it('mounts the shell over the live app state', () => {
    render(<App />);

    expect(screen.getByRole('log', { name: 'status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Window 1: status' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Command line' })).toHaveValue('');
  });
});
