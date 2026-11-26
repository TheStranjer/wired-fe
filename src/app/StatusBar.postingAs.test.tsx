/**
 * Tests for the posting-account entry on the status bar (WFE-285): shown while
 * the focused window has no account of its own (a feed, the status window),
 * hidden for a home window, and a click opens the account picker.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { StatusBar } from './StatusBar';
import { initialAppState } from '../state/appState';
import { type AppAction, appReducer } from '../state/reducer';
import { AppStateProvider, useAppState } from '../state/StateContext';
import { ALICE, LAIN, MAIN, OPEN_HOME, openFeed } from '../test/postasDesk';

/** Both accounts signed in, lain active. */
const SIGNED_IN: AppAction = { type: 'accounts', accounts: [LAIN, ALICE], activeKey: LAIN.key };

/** Shows what the picker state holds, so a click's effect can be read. */
function PickProbe(): JSX.Element {
  return <>{JSON.stringify(useAppState().accountPick)}</>;
}

/** Renders the status bar over a session moved along by {@link actions}. */
function renderBar(actions: readonly AppAction[]): void {
  render(
    <AppStateProvider initial={actions.reduce(appReducer, initialAppState())}>
      <StatusBar attachments={{ pending: [], showMedia: vi.fn() }} pendingKeys={null} />
      <output>
        <PickProbe />
      </output>
    </AppStateProvider>,
  );
}

describe('status bar posting-account entry', () => {
  it('shows the feed default in a feed window', () => {
    const feed = { ...MAIN, postAs: ALICE.key };
    renderBar([SIGNED_IN, { type: 'settings', settings: { feeds: [feed] } }, openFeed(feed)]);

    expect(
      screen.getByRole('button', { name: `Posting as @${ALICE.handle}, change` }),
    ).toBeVisible();
  });

  it('asks to choose in the status window when two accounts and no default leave it open', () => {
    renderBar([SIGNED_IN]);

    expect(screen.getByRole('button', { name: 'No posting account, choose' })).toHaveTextContent(
      '→?',
    );
  });

  it('is hidden in a home window, which has its own account', () => {
    renderBar([SIGNED_IN, OPEN_HOME]);

    expect(screen.queryByRole('button', { name: /posting/iu })).not.toBeInTheDocument();
  });

  it('opens the picker for the focused window when clicked', () => {
    renderBar([SIGNED_IN, { type: 'settings', settings: { feeds: [MAIN] } }, openFeed(MAIN)]);

    fireEvent.click(screen.getByRole('button', { name: 'No posting account, choose' }));

    expect(screen.getByRole('status')).toHaveTextContent('"purpose":"default"');
    expect(screen.getByRole('status')).toHaveTextContent('"windowId":"feed:-:f1"');
  });
});
