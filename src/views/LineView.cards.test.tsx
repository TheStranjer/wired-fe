/**
 * Tests for the post rendering a window picks (decision 15, WFE-227): cards by
 * default, IRC lines when the `density` setting or the window's own override
 * says so; avatars on a card follow the resolved `avatars`; and selection, the
 * scroll to the selected entry, content-warning toggles and label clicks work
 * in both renderings.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { type Mock, describe, expect, it, vi } from 'vitest';

import { LineView } from './LineView';
import type { StoredAccount } from '../accounts/accountStore';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { bufferFor } from '../state/selectors';
import type { Settings } from '../state/settings';
import { AppStateProvider } from '../state/StateContext';
import { status } from '../test/fixtures';
import { LINE_SETTINGS } from '../test/lineSettings';
import { windowId } from '../windows/model';
import type { DisplayOverrides, WindowRef } from '../windows/model';

const ORIGIN = 'https://wired.example';
const ACCOUNT_KEY = `${ORIGIN}#acct-1`;

/** The account the window under test belongs to. */
const ACCOUNT: StoredAccount = {
  key: ACCOUNT_KEY,
  origin: ORIGIN,
  accountId: 'acct-1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** The home window on {@link ACCOUNT}, and the id its ref names. */
const REF: WindowRef = { kind: 'home', accountKey: ACCOUNT_KEY, target: null };
const HOME = windowId(REF);

/** A post whose author's display name uses a custom emoji, and one with a warning. */
const NAMED = status('b', {
  account: {
    ...status('x').account,
    display_name: 'Lain :wave:',
    emojis: [{ shortcode: 'wave', url: 'https://wired.example/wave.png' }],
  },
});
const WARNED = status('cw', { spoiler_text: 'lain spoilers', content: '<p>the fourth wall</p>' });

/** The home window over `settings` and `display`, holding the two posts above. */
function seeded(settings: Settings, display: DisplayOverrides = {}): AppState {
  const signed = coreReducer(initialAppState(settings), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT_KEY,
  });
  const opened = coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: REF, title: 'home' },
  });
  const shown = coreReducer(opened, {
    type: 'windows',
    action: { type: 'setDisplay', id: HOME, overrides: display },
  });
  return appReducer(shown, {
    type: 'statuses',
    windowId: HOME,
    statuses: [WARNED, NAMED],
    where: 'newer',
  });
}

/** Render the home window's lines over {@link state}. */
function renderLines(state: AppState): void {
  render(
    <AppStateProvider initial={state}>
      {bufferFor(state, HOME).lines.map((line) => (
        <LineView key={line.key} line={line} windowId={HOME} />
      ))}
    </AppStateProvider>,
  );
}

/** Shadow a jsdom element's missing scrollIntoView with a recording mock. */
function fakeScrollIntoView(element: Element): Mock {
  const scrollIntoView = vi.fn();
  Object.defineProperty(element, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: scrollIntoView,
  });
  return scrollIntoView;
}

/** Whether the rendering shows the IRC `<handle>` bracket, as a line does. */
function isLine(): boolean {
  return document.body.textContent.includes('<lain@wired.example>');
}

describe('LineView density', () => {
  it('draws cards by default, with the display name and its avatar', () => {
    renderLines(seeded(initialAppState().settings));

    expect(isLine()).toBe(false);
    expect(screen.getAllByRole('img', { name: 'Avatar of @lain@wired.example' })).toHaveLength(2);
    expect(screen.getByRole('img', { name: ':wave:' })).toBeInTheDocument();
  });

  it('draws lines when the setting says lines', () => {
    renderLines(seeded(LINE_SETTINGS));

    expect(isLine()).toBe(true);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('draws lines in a window that overrides cards to lines', () => {
    renderLines(seeded(initialAppState().settings, { density: 'lines' }));

    expect(isLine()).toBe(true);
  });

  it('draws cards in a window that overrides lines to cards', () => {
    renderLines(seeded(LINE_SETTINGS, { density: 'cards' }));

    expect(isLine()).toBe(false);
    expect(screen.getAllByRole('img', { name: 'Avatar of @lain@wired.example' })).toHaveLength(2);
  });

  it('hides card avatars when the setting turns them off', () => {
    renderLines(seeded({ ...initialAppState().settings, avatars: false }));

    expect(screen.queryByRole('img', { name: 'Avatar of @lain@wired.example' })).toBeNull();
  });

  it('shows card avatars in a window that overrides them on', () => {
    renderLines(seeded({ ...initialAppState().settings, avatars: false }, { avatars: true }));

    expect(screen.getAllByRole('img', { name: 'Avatar of @lain@wired.example' })).toHaveLength(2);
  });
});

/** The settings that draw each density. */
const SETTINGS: Record<'cards' | 'lines', Settings> = {
  cards: initialAppState().settings,
  lines: LINE_SETTINGS,
};

describe.each(['cards', 'lines'] as const)('LineView %s selection', (density) => {
  it('selects the post whose label is clicked', () => {
    renderLines(seeded(SETTINGS[density]));

    fireEvent.click(screen.getByText('[a0]'));

    expect(screen.getByRole('article', { name: 'Post a0 by @lain@wired.example' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(
      screen.getByRole('article', { name: 'Post a1 by @lain@wired.example' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('scrolls the post into view when the selection moves onto it', () => {
    renderLines(seeded(SETTINGS[density]));
    const scrollIntoView = fakeScrollIntoView(
      screen.getByRole('article', { name: 'Post a0 by @lain@wired.example' }),
    );

    fireEvent.click(screen.getByText('[a0]'));

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('opens a content warning with its button', () => {
    renderLines(seeded(SETTINGS[density]));

    expect(screen.queryByText('the fourth wall')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '[CW: lain spoilers]' }));

    expect(screen.getByText('the fourth wall')).toBeInTheDocument();
  });
});
