/**
 * Tests that the pane title bar's text goes through `t()` (WFE-318, decision
 * 19): under a fake language the buttons' names and tooltips, the split menus'
 * rows and the display menu's rows, spoken names and reset row all follow it,
 * and a float's dock button too.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { DesktopView } from './DesktopView';
import { I18nProvider } from '../i18n/I18nProvider';
import type { AppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { installFakeLocale } from '../test/i18n';
import { twoPanes } from '../test/phantomPanes';

/** The messages the title bar reads, in the fake language. */
const FAKE = {
  app: {
    close_pane: 'Zap {title}',
    display_cards: 'Kards',
    display_options: 'Look of {title}',
    display_reset: 'Back to start',
    display_row_spoken:
      '{label}: {state, select, on {yes} on_overridden {yes!} off_overridden {no!} other {no}}',
    dock_window: 'Stick {title}',
    float_window: 'Pop {title}',
    menu_same_window: 'Same pane',
    split_side_by_side: 'Cut across',
    split_side_by_side_tip: 'Cut across with a thing',
    split_stacked: 'Cut down',
    tip_close: 'Zap it',
    tip_display: 'How it looks',
    tip_dock: 'Stick it',
    tip_float: 'Pop it out',
  },
};

/** Renders the desktop of {@link initial} under the provider that follows the language. */
function renderDesk(initial: AppState): void {
  const ui: JSX.Element = (
    <I18nProvider>
      <AppStateProvider initial={initial}>
        <DesktopView />
      </AppStateProvider>
    </I18nProvider>
  );
  render(ui);
}

/** Clicks the first button called {@link name}: the one on the first pane. */
function clickFirst(name: string): void {
  for (const button of screen.getAllByRole('button', { name }).slice(0, 1)) {
    fireEvent.click(button);
  }
}

/** `phantom/a` torn off into a float. */
function floatedA(): AppState {
  const focused = appReducer(twoPanes(), {
    type: 'layout',
    action: { type: 'focusPane', paneId: 'p1' },
  });
  return appReducer(focused, { type: 'layout', action: { type: 'float' } });
}

describe('the title bar in another language', () => {
  beforeEach(() => {
    installFakeLocale(FAKE);
  });

  it('words the names and tooltips of the tree pane buttons', () => {
    renderDesk(twoPanes());

    expect(screen.getByRole('button', { name: 'Pop phantom/a' })).toHaveAttribute(
      'title',
      expect.stringContaining('Pop it out: /float'),
    );
    expect(screen.getByRole('button', { name: 'Zap phantom/a' })).toHaveAttribute(
      'title',
      expect.stringContaining('Zap it: /unsplit'),
    );
    expect(screen.getAllByRole('button', { name: 'Cut across' })[0]).toHaveAttribute(
      'title',
      expect.stringContaining('Cut across with a thing: /vsplit'),
    );
    expect(screen.getAllByRole('button', { name: 'Cut down' })[0]).toBeVisible();
  });

  it("words a float's dock button", () => {
    renderDesk(floatedA());

    expect(screen.getByRole('button', { name: 'Stick phantom/a' })).toHaveAttribute(
      'title',
      expect.stringContaining('Stick it: /dock'),
    );
  });

  it('words the rows of a split menu', () => {
    renderDesk(twoPanes());

    clickFirst('Cut across');

    expect(screen.getByRole('menuitem', { name: 'Same pane' })).toBeVisible();
  });

  it('words the display menu, its spoken names and its reset row', () => {
    const overridden = appReducer(twoPanes(), {
      type: 'windows',
      action: { type: 'setDisplay', id: 'phantom:-:a', overrides: { avatars: false } },
    });
    renderDesk(overridden);

    clickFirst('Look of phantom/a');

    expect(screen.getByRole('menuitemcheckbox', { name: 'Kards: yes' })).toBeChecked();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Avatars: no!' })).not.toBeChecked();
    expect(screen.getByRole('menuitem', { name: 'Back to start' })).toBeVisible();
  });
});
