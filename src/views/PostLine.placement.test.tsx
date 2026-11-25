/**
 * Tests for placing the windows a post line's clicks open (WFE-238, decision
 * 13): a nick, a hashtag and a mention open where the settings say on a plain
 * click, in a float on Ctrl or Cmd, beside the pane on Shift, and hidden on
 * the middle button — read back from where the real reducer put the window.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PostLine } from './PostLine';
import type { StoredAccount } from '../accounts/accountStore';
import { coreReducer, initialAppState } from '../state/appState';
import { DEFAULT_SETTINGS, type Settings } from '../state/settings';
import { AppStateProvider } from '../state/StateContext';
import { status } from '../test/fixtures';
import { PLACEMENT_PROBE, PlacementProbe } from '../test/placementProbe';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const ORIGIN = 'https://wired.example';
const ACCOUNT_KEY = `${ORIGIN}#acct-1`;

/** The account the home window under test belongs to. */
const ACCOUNT: StoredAccount = {
  key: ACCOUNT_KEY,
  origin: ORIGIN,
  accountId: 'acct-1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** The home window on {@link ACCOUNT}. */
const REF: WindowRef = { kind: 'home', accountKey: ACCOUNT_KEY, target: null };
const HOME = windowId(REF);

/** A post that carries a hashtag and a mention. */
const POST = status('p1', {
  content:
    '<p><a href="https://wired.example/tags/rust">#rust</a> ' +
    '<a href="https://wired.example/users/ally">@ally</a></p>',
  mentions: [{ id: 'a9', username: 'ally', acct: 'ally', url: 'https://wired.example/users/ally' }],
  tags: [{ name: 'Rust', url: 'https://wired.example/tags/rust' }],
});

/** The post's window shown alone in its pane, and {@link POST} rendered with the probe beside it. */
function renderPost(settings: Settings = DEFAULT_SETTINGS): void {
  const signed = coreReducer(initialAppState(settings), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT_KEY,
  });
  const state = coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: REF, title: 'home' },
  });
  render(
    <AppStateProvider initial={state}>
      <PostLine lineKey="p1" status={POST} windowId={HOME} />
      <PlacementProbe />
    </AppStateProvider>,
  );
}

/** Dispatch the middle button's auxiliary click on {@link element}. */
function middleClick(element: HTMLElement): void {
  fireEvent(element, new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
}

/** What the probe says about where the windows are. */
function placed(): HTMLElement {
  return screen.getByRole('region', { name: PLACEMENT_PROBE });
}

describe('the placement of a hashtag link click', () => {
  it('opens in the focused pane on a plain click by default', () => {
    renderPost();

    fireEvent.click(screen.getByRole('link', { name: '#rust' }));

    expect(placed()).toHaveTextContent('panes: #rust | floats: -');
  });

  it('opens a vsplit with Shift', () => {
    renderPost();

    const proceeded = fireEvent.click(screen.getByRole('link', { name: '#rust' }), {
      shiftKey: true,
    });

    expect(proceeded).toBe(false);
    expect(placed()).toHaveTextContent('panes: home, #rust | floats: -');
  });

  it.each([{ ctrlKey: true }, { metaKey: true }])('opens a float with %j', (init) => {
    renderPost();

    fireEvent.click(screen.getByRole('link', { name: '#rust' }), init);

    expect(placed()).toHaveTextContent('panes: home | floats: #rust');
  });

  it('opens it hidden on a middle click, without a new browser tab', () => {
    renderPost();

    middleClick(screen.getByRole('link', { name: '#rust' }));

    expect(placed()).toHaveTextContent('panes: home | floats: -');
  });

  it('follows the per-kind setting on a plain click', () => {
    renderPost({ ...DEFAULT_SETTINGS, openInByKind: { hashtag: 'float' } });

    fireEvent.click(screen.getByRole('link', { name: '#rust' }));

    expect(placed()).toHaveTextContent('panes: home | floats: #rust');
  });
});

describe('the placement of a mention link click', () => {
  it('opens the profile in a vsplit with Shift', () => {
    renderPost();

    fireEvent.click(screen.getByRole('link', { name: '@ally' }), { shiftKey: true });

    expect(placed()).toHaveTextContent('panes: home, @ally | floats: -');
  });
});

describe('the placement of a nick click', () => {
  const NICK = '@lain@wired.example';

  it('opens the profile in the focused pane on a plain click', () => {
    renderPost();

    fireEvent.click(screen.getByRole('button', { name: NICK }));

    expect(placed()).toHaveTextContent(`panes: ${NICK} | floats: -`);
  });

  it('opens the profile in a vsplit with Shift', () => {
    renderPost();

    fireEvent.click(screen.getByRole('button', { name: NICK }), { shiftKey: true });

    expect(placed()).toHaveTextContent(`panes: home, ${NICK} | floats: -`);
  });

  it.each([{ ctrlKey: true }, { metaKey: true }])(
    'opens the profile in a float with %j',
    (init) => {
      renderPost();

      fireEvent.click(screen.getByRole('button', { name: NICK }), init);

      expect(placed()).toHaveTextContent(`panes: home | floats: ${NICK}`);
    },
  );

  it('opens the profile hidden on a middle click', () => {
    renderPost();

    middleClick(screen.getByRole('button', { name: NICK }));

    expect(placed()).toHaveTextContent('panes: home | floats: -');
  });

  it('follows the default placement on a plain click', () => {
    renderPost({ ...DEFAULT_SETTINGS, openIn: 'split' });

    fireEvent.click(screen.getByRole('button', { name: NICK }));

    expect(placed()).toHaveTextContent(`panes: home, ${NICK} | floats: -`);
  });
});
