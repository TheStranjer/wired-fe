/**
 * Tests for placing the profile window a nick click in the people window
 * opens (WFE-238, decision 13): Shift a vsplit, Ctrl a float, the middle
 * button hidden, a plain click the configured placement.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import { accountKey, type StoredAccount } from '../../accounts/accountStore';
import { initialAppState } from '../../state/appState';
import { peopleWindowId, peopleWindowOpen } from '../../state/peopleWindow';
import { type AppAction, appReducer } from '../../state/reducer';
import { DEFAULT_SETTINGS, type Settings } from '../../state/settings';
import { AppStateProvider } from '../../state/StateContext';
import { status } from '../../test/fixtures';
import { PLACEMENT_PROBE, PlacementProbe } from '../../test/placementProbe';
import { windowId } from '../../windows/model';
import type { WindowRef } from '../../windows/model';

const ORIGIN = 'https://wired.example';

const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

const HOME: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };

/** The people window of a home window that holds lain's own post, over {@link settings}. */
function renderPeople(settings: Settings = DEFAULT_SETTINGS): void {
  const actions: readonly AppAction[] = [
    { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
    { type: 'windows', action: { type: 'open', ref: HOME, title: 'home' } },
    { type: 'statuses', windowId: windowId(HOME), statuses: [status('o1')], where: 'newer' },
  ];
  const opened = actions.reduce(appReducer, initialAppState(settings));
  const watched = opened.windows.windows.find((win) => win.id === windowId(HOME));
  if (watched === undefined) {
    throw new Error('the home window is not open');
  }
  const state = appReducer(opened, { type: 'windows', action: peopleWindowOpen(watched) });
  const { Component } = windowKind;
  render(
    <AppStateProvider initial={state}>
      <Component windowId={peopleWindowId(watched)} />
      <PlacementProbe />
    </AppStateProvider>,
  );
}

const NICK = '@lain@wired.example';

/** What the probe says about where the windows are. */
function placed(): HTMLElement {
  return screen.getByRole('region', { name: PLACEMENT_PROBE });
}

describe('the placement of a people window nick click', () => {
  it('opens the profile in the focused pane on a plain click', () => {
    renderPeople();

    fireEvent.click(screen.getByRole('button', { name: NICK }));

    expect(placed()).toHaveTextContent(`panes: ${NICK} | floats: -`);
  });

  it('opens the profile in a vsplit with Shift', () => {
    renderPeople();

    fireEvent.click(screen.getByRole('button', { name: NICK }), { shiftKey: true });

    expect(placed()).toHaveTextContent(`panes: people:home, ${NICK} | floats: -`);
  });

  it('opens the profile in a float with Ctrl', () => {
    renderPeople();

    fireEvent.click(screen.getByRole('button', { name: NICK }), { ctrlKey: true });

    expect(placed()).toHaveTextContent(`panes: people:home | floats: ${NICK}`);
  });

  it('opens the profile hidden on a middle click', () => {
    renderPeople();

    fireEvent(
      screen.getByRole('button', { name: NICK }),
      new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }),
    );

    expect(placed()).toHaveTextContent('panes: people:home | floats: -');
  });

  it('follows the per-kind setting on a plain click', () => {
    renderPeople({ ...DEFAULT_SETTINGS, openInByKind: { profile: 'float' } });

    fireEvent.click(screen.getByRole('button', { name: NICK }));

    expect(placed()).toHaveTextContent(`panes: people:home | floats: ${NICK}`);
  });
});
