/**
 * Tests that the app's chrome goes through `t()` (WFE-318, decision 19): under
 * a fake language the header's no-account text, the dock announcement (with
 * its edge), the mobile pane switcher, the stand-in for a window kind that
 * never loaded and the line a prefill prints without a selection all follow it.
 */
import { render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppHeader } from './AppHeader';
import { DockHint } from './DockHint';
import { fillCommandLine } from './hotkeyPrefill';
import { PaneSwitcher } from './PaneSwitcher';
import { WindowBody } from './WindowBody';
import { I18nProvider } from '../i18n/I18nProvider';
import { initialAppState } from '../state/appState';
import { AppStateProvider } from '../state/StateContext';
import { fakeCommandContext } from '../test/commandContext';
import { installFakeLocale } from '../test/i18n';
import { twoPanes } from '../test/phantomPanes';

/** The messages the chrome reads, in the fake language. */
const FAKE = {
  app: {
    account_none: 'nobody',
    dock_announce: 'Glue {edge, select, left {west} other {elsewhere}} of #{title}',
    no_view: 'Nothing to see',
    pane_next: 'Onward',
    pane_previous: 'Backward',
    pane_switch: 'Jump, {count}',
    select_post_first: 'Pick a post (j/k)',
  },
};

/** Draws {@link ui} under the provider that follows the language, over the empty session. */
function show(ui: JSX.Element): void {
  render(
    <I18nProvider>
      <AppStateProvider initial={initialAppState()}>{ui}</AppStateProvider>
    </I18nProvider>,
  );
}

describe('the app chrome in another language', () => {
  beforeEach(() => {
    installFakeLocale(FAKE);
  });

  it('words the header while no account is signed in', () => {
    show(<AppHeader />);

    expect(screen.getByText('nobody')).toBeVisible();
  });

  it('words the dock announcement, its edge included', () => {
    show(
      <DockHint
        target={{ paneId: 'p1', edge: 'left', zone: { x: 0, y: 0, w: 0.5, h: 1 } }}
        title="home"
      />,
    );

    expect(screen.getByText('Glue west of #home')).toBeInTheDocument();
  });

  it('words the buttons of the mobile pane switcher', () => {
    show(
      <PaneSwitcher
        entries={[
          { paneId: 'p1', title: 'a' },
          { paneId: 'p2', title: 'b' },
        ]}
        index={0}
      />,
    );

    expect(screen.getByRole('button', { name: 'Backward' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Jump, 1/2' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Onward' })).toBeVisible();
  });

  it('words the stand-in for a window whose kind never loaded', () => {
    const state = twoPanes();
    const phantoms = state.windows.windows.filter((win) => win.title === 'phantom/a');

    show(
      <>
        {phantoms.map((win) => (
          <WindowBody key={win.id} win={win} state={state} />
        ))}
      </>,
    );

    expect(screen.getByText('Nothing to see')).toBeVisible();
  });

  it('words what a prefill that wants a label prints while nothing is selected', () => {
    const print = vi.fn<(text: string) => void>();

    fillCommandLine('/reply {label}', fakeCommandContext({ print }), () => undefined);

    expect(print).toHaveBeenCalledExactlyOnceWith('Pick a post (j/k)');
  });
});
