/**
 * Tests for what an empty desktop draws (WFE-298): the dim hint and the list
 * of views the pane menus offer, less `Attach media…` and `Existing window…`.
 * A plain row runs `/vsplit <view>` through the post-action runner, a row that
 * asks opens its dialog and runs the answered line, and the mobile device
 * class draws the same list.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DesktopView } from './DesktopView';
import type { DeviceClass } from '../lib/deviceClass';
import { initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import type { PostActionLine } from '../ui/postActionTypes';
import { PostActionsProvider } from '../views/PostActionsContext';

/** Draws desktop 2, which is empty, answering the spy that collects the lines run. */
function showEmpty(deviceClass: DeviceClass = 'desktop'): (line: PostActionLine) => void {
  const run = vi.fn<(line: PostActionLine) => void>();
  const state = appReducer(initialAppState(), {
    type: 'layout',
    action: { type: 'goToDesktop', n: 2 },
  });
  render(
    <AppStateProvider initial={state}>
      <PostActionsProvider actions={{ linesFor: () => ({}), run }}>
        <DesktopView deviceClass={deviceClass} />
      </PostActionsProvider>
    </AppStateProvider>,
  );
  return run;
}

describe('the empty desktop', () => {
  it('keeps the hint as one line above the view list', () => {
    showEmpty();

    expect(screen.getByText('empty desktop — /vsplit, /split or Ctrl+B %')).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Open a view' })).toBeInTheDocument();
  });

  it('lists the views of the pane menus, but not Attach media… or Existing window…', () => {
    showEmpty();

    const names = screen.getAllByRole('button').map((button) => button.textContent);

    expect(names).toStrictEqual(expect.arrayContaining(['Home', 'Composer', 'Hashtag…', 'DM…']));
    expect(names).not.toContain('Attach media…');
    expect(names).not.toContain('Existing window…');
  });

  it('runs /vsplit home for the Home row', () => {
    const run = showEmpty();

    fireEvent.click(screen.getByRole('button', { name: 'Home' }));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/vsplit home', prefill: false });
  });

  it('opens the dialog for Hashtag… and runs the answered line', () => {
    const run = showEmpty();

    fireEvent.click(screen.getByRole('button', { name: 'Hashtag…' }));
    const input = screen.getByRole('combobox', { name: 'Open a view' });
    fireEvent.change(input, { target: { value: '#rust' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/vsplit tag rust', prefill: false });
  });

  it('draws the same list on a mobile device class', () => {
    const run = showEmpty('mobile');

    fireEvent.click(screen.getByRole('button', { name: 'Local' }));

    expect(run).toHaveBeenCalledExactlyOnceWith({ line: '/vsplit local', prefill: false });
  });
});
