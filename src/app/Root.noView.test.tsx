/**
 * Tests for the shell's stand-in scrollback (AGENTS.md "Windows, like IRC
 * buffers"): a window whose kind no feature implements shows the no-view
 * notice in a log region named after the window's title. Every kind the model
 * names today has a view, so the ref carries a phantom kind the model could
 * hold but no src/features folder answers.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import type { WindowKind, WindowRef } from '../windows/model';

/** Startup has its own tests; the shell tests do not boot the session. */
vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

/** The window: a kind no shipped feature implements, active on open. */
const PHANTOM: WindowRef = {
  kind: 'phantom' as unknown as WindowKind,
  accountKey: null,
  target: 'lain',
};

/** A fresh session with the phantom window open. */
function phantomState() {
  return appReducer(initialAppState(), {
    type: 'windows',
    action: { type: 'open', ref: PHANTOM, title: 'phantom/lain' },
  });
}

describe('the shell for a window kind no feature implements', () => {
  it('shows the no-view notice in a region named after the window', () => {
    render(
      <AppStateProvider initial={phantomState()}>
        <Root />
      </AppStateProvider>,
    );

    const log = screen.getByRole('log', { name: 'phantom/lain' });

    expect(within(log).getByText('No view for this window')).toBeInTheDocument();
  });
});
