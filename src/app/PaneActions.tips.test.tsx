/**
 * Tests for the tooltips of the pane title-bar buttons (WFE-312): each button
 * has a `title` naming its action, its command and its keys from the effective
 * keymap, so a rebind changes it; the dock button is drawn `⇲`; the menu
 * buttons carry their title.
 */
import { render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { DesktopView } from './DesktopView';
import { initialAppState } from '../state/appState';
import type { AppState } from '../state/appState';
import { feedWindowOpen } from '../state/feedWindow';
import { appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { twoPanes } from '../test/phantomPanes';

/** Two panes with a, the focused one, torn off into a float. */
function floatedA(): AppState {
  const focused = appReducer(twoPanes(), {
    type: 'layout',
    action: { type: 'focusPane', paneId: 'p1' },
  });
  return appReducer(focused, { type: 'layout', action: { type: 'float' } });
}

/** {@link state} with the navigation chord `w d` rebound to `/about` and `Ctrl+e` to `/dock`. */
function reboundDock(state: AppState): AppState {
  return appReducer(state, {
    type: 'settings',
    settings: {
      keyOverrides: [
        { mode: 'navigation', chord: 'w d', line: null },
        { mode: 'navigation', chord: 'Ctrl+e', line: '/dock' },
      ],
    },
  });
}

/** Renders the desktop of {@link initial}. */
function renderDesk(initial: AppState): JSX.Element {
  return (
    <AppStateProvider initial={initial}>
      <DesktopView />
    </AppStateProvider>
  );
}

describe('the title-bar tooltips', () => {
  it('names the action, the command and the default keys of the tree pane buttons', () => {
    render(renderDesk(twoPanes()));

    expect(screen.getByRole('button', { name: 'Float phantom/a' })).toHaveAttribute(
      'title',
      'Tear off into a floating window: /float (Ctrl+b f, w f)',
    );
    expect(screen.getByRole('button', { name: 'Close pane phantom/a' })).toHaveAttribute(
      'title',
      'Close this pane: /unsplit (Ctrl+b x, w c)',
    );
  });

  it('puts the title on the split menu buttons', () => {
    render(renderDesk(twoPanes()));

    expect(screen.getAllByRole('button', { name: 'Split side by side' })[0]).toHaveAttribute(
      'title',
      'Split side by side with a view: /vsplit (Ctrl+b %, w v)',
    );
    expect(screen.getAllByRole('button', { name: 'Split stacked' })[0]).toHaveAttribute(
      'title',
      'Split stacked with a view: /split (Ctrl+b ", w s)',
    );
  });

  it('draws the dock button as ⇲ with its command and keys', () => {
    render(renderDesk(floatedA()));

    const dock = screen.getByRole('button', { name: 'Dock phantom/a' });

    expect(dock).toHaveTextContent('⇲');
    expect(dock).toHaveAttribute('title', 'Dock into the tiles: /dock (Ctrl+b d, w d)');
  });

  it('shows the new key after a rebind', () => {
    render(renderDesk(reboundDock(floatedA())));

    expect(screen.getByRole('button', { name: 'Dock phantom/a' })).toHaveAttribute(
      'title',
      'Dock into the tiles: /dock (Ctrl+b d, Ctrl+e)',
    );
  });
});

describe('the tooltips of a feed window', () => {
  it('names the edit and display buttons by their commands', () => {
    const main = { id: 'f1', name: 'main', sources: [] };
    const saved = appReducer(initialAppState(), { type: 'settings', settings: { feeds: [main] } });

    render(renderDesk(appReducer(saved, { type: 'windows', action: feedWindowOpen(main) })));

    expect(screen.getByRole('button', { name: 'Edit feed ~main' })).toHaveAttribute(
      'title',
      'Edit this feed: /feed edit',
    );
    expect(screen.getByRole('button', { name: 'Display options for ~main' })).toHaveAttribute(
      'title',
      'How posts are drawn: /display',
    );
  });
});
