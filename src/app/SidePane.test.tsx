/**
 * Tests for the side pane (WFE-133): the heading the window's kind earns, the
 * buffer's participants as clickable nicks named from the window's own account
 * (and by their own handle when no account grounds them), the pane that stays
 * empty for the notifications window, and a nick click opening the author's
 * profile window through the reducer.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { SidePane } from './SidePane';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { type AppState, initialAppState } from '../state/appState';
import { type AppAction, appReducer } from '../state/reducer';
import { AppStateProvider, useAppState } from '../state/StateContext';
import { status, TEST_DATE } from '../test/fixtures';
import { windowId } from '../windows/model';
import type { WindowRef, WindowState } from '../windows/model';

const ORIGIN = 'https://wired.example';

const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
};

/** An author in the shape the Status schema reads, keyed by its handle. */
function author(acct: string) {
  return {
    id: acct,
    username: acct.split('@')[0] ?? acct,
    acct,
    fqn: null,
    display_name: '',
    locked: false,
    bot: false,
    group: false,
    discoverable: null,
    created_at: TEST_DATE,
    note: '',
    url: `https://m.example/@${acct}`,
    uri: null,
    avatar: '',
    avatar_static: '',
    header: '',
    header_static: '',
    followers_count: 0,
    following_count: 0,
    statuses_count: 0,
    last_status_at: null,
    emojis: [],
    fields: [],
    moved: null,
    pleroma: null,
  };
}

const ALICE = status('a1', { account: author('alice@m.example') });
const OWN = status('o1', { account: author('lain@wired.example') });
const BOB = status('b1', { account: author('bob') });

const HOME: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };

/** A session moved along by {@link actions}. */
function session(actions: readonly AppAction[]): AppState {
  return actions.reduce(appReducer, initialAppState());
}

/** The action that opens {@link ref} as a window. */
function open(ref: WindowRef): AppAction {
  return { type: 'windows', action: { type: 'open', ref, title: ref.kind } };
}

/** A signed-in home window showing alice's post as the newest line. */
function seedHome(): readonly AppAction[] {
  return [
    { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
    open(HOME),
    { type: 'statuses', windowId: windowId(HOME), statuses: [ALICE, OWN], where: 'newer' },
  ];
}

/** The window {@link ref} opened into {@link state}. */
function winOf(state: AppState, ref: WindowRef): WindowState {
  const win = state.windows.windows.find((candidate) => candidate.id === windowId(ref));
  if (win === undefined) {
    throw new Error(`no window for ${windowId(ref)}`);
  }
  return win;
}

/** The window titles the state holds, one span per window. */
function WindowTitles(): JSX.Element {
  const state = useAppState();
  return (
    <section aria-label="windows">
      {state.windows.windows.map((win) => (
        <span key={win.id}>{win.title}</span>
      ))}
    </section>
  );
}

/** Render the pane of {@link ref}'s window over a session built from {@link actions}. */
function renderPane(actions: readonly AppAction[], ref: WindowRef): void {
  const state = session(actions);
  render(
    <AppStateProvider initial={state}>
      <SidePane win={winOf(state, ref)} />
      <WindowTitles />
    </AppStateProvider>,
  );
}

describe(SidePane, () => {
  it('lists the home window under "recently here", most recent first', () => {
    renderPane(seedHome(), HOME);

    expect(screen.getByText('recently here')).toBeInTheDocument();

    const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'));

    expect(names).toStrictEqual(['@alice@m.example', '@lain@wired.example']);
  });

  it('names a thread window "in thread"', () => {
    const ref: WindowRef = { kind: 'thread', accountKey: ACCOUNT.key, target: '9' };

    renderPane([open(ref)], ref);

    expect(screen.getByText('in thread')).toBeInTheDocument();
  });

  it('names a dm window "in conversation"', () => {
    const ref: WindowRef = { kind: 'dm', accountKey: ACCOUNT.key, target: 'bob@x.example' };

    renderPane([open(ref)], ref);

    expect(screen.getByText('in conversation')).toBeInTheDocument();
  });

  it('shows no pane for windows that gather nobody', () => {
    const ref: WindowRef = { kind: 'notifications', accountKey: ACCOUNT.key, target: null };

    renderPane([open(ref)], ref);

    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByText('recently here')).toBeNull();
  });

  it('opens the author profile window when a nick is clicked', () => {
    renderPane(seedHome(), HOME);

    fireEvent.click(screen.getByRole('button', { name: '@alice@m.example' }));

    expect(screen.getByRole('region', { name: 'windows' })).toHaveTextContent('@alice@m.example');
  });

  it('names accounts by their own handle when no account grounds them', () => {
    const ref: WindowRef = { kind: 'home', accountKey: null, target: null };
    const actions: readonly AppAction[] = [
      { type: 'windows', action: { type: 'open', ref, title: 'home' } },
      { type: 'statuses', windowId: windowId(ref), statuses: [BOB], where: 'newer' },
    ];

    renderPane(actions, ref);

    expect(screen.getByRole('button', { name: '@bob' })).toBeInTheDocument();
  });
});
