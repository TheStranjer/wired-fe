/**
 * Tests for the sync marker on the status bar (decision 17): nothing while
 * the sync is idle, `⇅` while a push waits, `⇅!` after an error, and the
 * error wins over a push that waits again.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusBar } from './StatusBar';
import { initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import type { SyncStatus } from '../state/syncStatus';

/** Renders the status bar over a session whose sync status is {@link status}. */
function renderBar(status: Partial<SyncStatus>): void {
  const state = appReducer(initialAppState(), { type: 'sync', status });
  render(
    <AppStateProvider initial={state}>
      <StatusBar pendingMedia={0} pendingKeys={null} />
    </AppStateProvider>,
  );
}

describe('status bar sync marker', () => {
  it('shows nothing while the sync is idle', () => {
    renderBar({});

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows ⇅ while a push waits', () => {
    renderBar({ pending: true });

    expect(screen.getByRole('img', { name: 'Sync pending' })).toHaveTextContent('⇅');
  });

  it('shows ⇅! after an error', () => {
    renderBar({ failed: true });

    expect(screen.getByRole('img', { name: 'Sync failed' })).toHaveTextContent('⇅!');
  });

  it('shows the error even while another push waits', () => {
    renderBar({ failed: true, pending: true });

    expect(screen.getByRole('img', { name: 'Sync failed' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Sync pending' })).not.toBeInTheDocument();
  });
});
