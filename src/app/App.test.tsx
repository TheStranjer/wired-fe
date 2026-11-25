/**
 * Tests for the booted application: the visually hidden heading, and the
 * live shell the state provider mounts beneath it — the status window's log
 * and topic, the window list, and the command line.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App';

/** Startup has its own tests; the shell tests do not boot the session. */
vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

describe(App, () => {
  it('shows WIRED as the page heading', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WIRED');
  });

  it('mounts the shell over the live app state', () => {
    render(<App />);

    expect(screen.getByRole('log', { name: 'status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desktop 1, active' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Command line' })).toHaveValue('');
  });
});
