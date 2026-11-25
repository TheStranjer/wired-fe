/**
 * Tests for the people window kind (WFE-220, migrated from the side pane's
 * tests): the definition, headings per watched kind, nicks named from the
 * watched window's account, the list following the buffer, the dim notices,
 * and a nick click opening the author's profile window.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import { accountKey, type StoredAccount } from '../../accounts/accountStore';
import { type AppState, initialAppState } from '../../state/appState';
import { peopleWindowId, peopleWindowOpen } from '../../state/peopleWindow';
import { type AppAction, appReducer } from '../../state/reducer';
import { AppStateProvider, useAppDispatch, useAppState } from '../../state/StateContext';
import { status, TEST_DATE } from '../../test/fixtures';
import { windowId } from '../../windows/model';
import type { WindowRef, WindowState } from '../../windows/model';

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

function author(acct: string) {
  return {
    id: acct,
    username: acct.split('@')[0] ?? acct,
    acct,
    display_name: '',
    created_at: TEST_DATE,
    note: '',
    url: `https://m.example/@${acct}`,
    avatar: '',
    header: '',
    followers_count: 0,
    following_count: 0,
    statuses_count: 0,
  };
}

const ALICE = status('a1', { account: author('alice@m.example') });
const OWN = status('o1', { account: author('lain@wired.example') });
const BOB = status('b1', { account: author('bob') });
const CAROL = status('c1', { account: author('carol@m.example') });

const HOME: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };

function session(actions: readonly AppAction[]): AppState {
  return actions.reduce(appReducer, initialAppState());
}

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

function winOf(state: AppState, ref: WindowRef): WindowState {
  const win = state.windows.windows.find((candidate) => candidate.id === windowId(ref));
  if (win === undefined) {
    throw new Error(`no window for ${windowId(ref)}`);
  }
  return win;
}

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

/** Buttons that let a test change the session while the people window is on screen. */
function Controls(): JSX.Element {
  const dispatch = useAppDispatch();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          dispatch({
            type: 'statuses',
            windowId: windowId(HOME),
            statuses: [CAROL],
            where: 'newer',
          });
        }}
      >
        carol arrives
      </button>
      <button
        type="button"
        onClick={() => {
          dispatch({ type: 'windows', action: { type: 'close', id: windowId(HOME) } });
        }}
      >
        close watched
      </button>
    </>
  );
}

/** Render the people window of {@link ref}'s window over a session built from {@link actions}. */
function renderPeople(actions: readonly AppAction[], ref: WindowRef): void {
  const opened = session(actions);
  const watched = winOf(opened, ref);
  const state = appReducer(opened, { type: 'windows', action: peopleWindowOpen(watched) });
  const { Component } = windowKind;
  render(
    <AppStateProvider initial={state}>
      <Component windowId={peopleWindowId(watched)} />
      <WindowTitles />
      <Controls />
    </AppStateProvider>,
  );
}

describe('the people window kind', () => {
  it('is the definition for the people kind, titled as its window, and takes no posts', () => {
    const state = session(seedHome());
    const opening = peopleWindowOpen(winOf(state, HOME));
    const people = appReducer(state, { type: 'windows', action: opening });

    expect(windowKind.kind).toBe('people');
    expect(windowKind.onPost).toBeUndefined();
    expect(windowKind.topic(winOf(people, opening.ref), people)).toBe('people:home');
  });

  it('lists the watched home window under "recently here", most recent first', () => {
    renderPeople(seedHome(), HOME);

    expect(screen.getByText('recently here')).toBeInTheDocument();

    const list = screen.getByRole('list', { name: 'recently here' });
    const names = within(list)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));

    expect(names).toStrictEqual(['@alice@m.example', '@lain@wired.example']);
  });

  it('follows the watched buffer as lines arrive', () => {
    renderPeople(seedHome(), HOME);

    fireEvent.click(screen.getByRole('button', { name: 'carol arrives' }));

    expect(screen.getByRole('button', { name: '@carol@m.example' })).toBeInTheDocument();
  });

  it.each([
    ['thread', '9', 'in thread'],
    ['dm', 'bob@x.example', 'in conversation'],
  ] as const)('names a %s window "%s"', (kind, target, heading) => {
    const ref: WindowRef = { kind, accountKey: ACCOUNT.key, target };

    renderPeople([open(ref)], ref);

    expect(screen.getByText(heading)).toBeInTheDocument();
  });

  it('says nobody is gathered in windows that gather nobody', () => {
    const ref: WindowRef = { kind: 'notifications', accountKey: ACCOUNT.key, target: null };

    renderPeople([open(ref)], ref);

    expect(screen.getByText('nobody gathered here')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('opens the author profile window when a nick is clicked', () => {
    renderPeople(seedHome(), HOME);

    fireEvent.click(screen.getByRole('button', { name: '@alice@m.example' }));

    expect(screen.getByRole('region', { name: 'windows' })).toHaveTextContent('@alice@m.example');
  });

  it('names accounts by their own handle (fqn first) when no account grounds them', () => {
    const ref: WindowRef = { kind: 'home', accountKey: null, target: null };
    const dave = status('d1', { account: { ...author('dave'), fqn: 'dave@far.example' } });
    const actions: readonly AppAction[] = [
      { type: 'windows', action: { type: 'open', ref, title: 'home' } },
      { type: 'statuses', windowId: windowId(ref), statuses: [BOB, dave], where: 'newer' },
    ];

    renderPeople(actions, ref);

    expect(screen.getByRole('button', { name: '@bob' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '@dave@far.example' })).toBeInTheDocument();
  });

  it('says "window closed" for a people window the list has no record of', () => {
    const { Component } = windowKind;

    render(
      <AppStateProvider initial={initialAppState()}>
        <Component windowId="people:-:nowhere" />
      </AppStateProvider>,
    );

    expect(screen.getByText('window closed')).toBeInTheDocument();
  });

  it('shows a dim "window closed" line once the watched window is closed', () => {
    renderPeople(seedHome(), HOME);

    fireEvent.click(screen.getByRole('button', { name: 'close watched' }));

    expect(screen.getByText('window closed')).toBeInTheDocument();
    expect(screen.queryByText('recently here')).toBeNull();
  });
});
