/**
 * Tests that the start menu, the empty desktop and the lists of views they
 * share go through `t()` (WFE-318, decision 19): under a fake language the
 * button, the lists' names, the hint, the rows and the dialog a row opens
 * all follow it.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DesktopView } from './DesktopView';
import { StartMenu } from './StartMenu';
import { I18nProvider } from '../i18n/I18nProvider';
import { type AppState, initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { installFakeLocale } from '../test/i18n';
import type { PostActionLine } from '../ui/postActionTypes';
import { PostActionsProvider } from '../views/PostActionsContext';

/** The messages the lists read, in the fake language. */
const FAKE = {
  app: {
    ask_hashtag_placeholder: '#etiqueta',
    ask_hashtag_title: 'Cut with a tag',
    empty_desktop_hint: 'nothing here, try /vsplit',
    menu_hashtag: 'Tag…',
    menu_home: 'Casa',
    open_view: 'Open one',
    open_view_float: 'Open one floating',
    start_menu_label: '[≡ wired] begin',
  },
};

/** Draws {@link ui} over {@link state}, answering the spy that collects the lines run. */
function show(state: AppState, ui: JSX.Element): void {
  const run = vi.fn<(line: PostActionLine) => void>();
  render(
    <I18nProvider>
      <AppStateProvider initial={state}>
        <PostActionsProvider actions={{ linesFor: () => ({}), run }}>{ui}</PostActionsProvider>
      </AppStateProvider>
    </I18nProvider>,
  );
}

describe('the lists of views in another language', () => {
  beforeEach(() => {
    installFakeLocale(FAKE);
  });

  it('words the start menu: its button, its list and its rows', () => {
    show(appReducer(initialAppState(), { type: 'startMenu', open: true }), <StartMenu />);

    expect(screen.getByRole('button', { name: '[≡ wired] begin' })).toBeVisible();
    expect(screen.getByRole('toolbar', { name: 'Open one floating' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Casa' })).toBeVisible();
  });

  it('words the dialog of a row that asks for an argument', () => {
    show(appReducer(initialAppState(), { type: 'startMenu', open: true }), <StartMenu />);

    fireEvent.click(screen.getByRole('button', { name: 'Tag…' }));

    expect(screen.getByText('Cut with a tag')).toBeVisible();
    expect(screen.getByPlaceholderText('#etiqueta')).toBeVisible();
  });

  it('words the empty desktop: its hint, its list and its rows', () => {
    const empty = appReducer(initialAppState(), {
      type: 'layout',
      action: { type: 'goToDesktop', n: 2 },
    });
    show(empty, <DesktopView deviceClass="desktop" />);

    expect(screen.getByText('nothing here, try /vsplit')).toBeVisible();
    expect(screen.getByRole('toolbar', { name: 'Open one' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Casa' })).toBeVisible();
  });
});
