/**
 * Tests for the shared line views: a client message as stored, a post row seen
 * through its window's account, and a notification as the client message it is
 * until its own view lands. Each renders inside AppStateProvider over a state
 * holding one window and one buffer with a line of every kind, and the reader's
 * own moves — selection, content-warning reveal — are asserted on the rendered
 * row, since the real reducer is what the view dispatches to.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LineView } from './LineView';
import type { StoredAccount } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import type { LineData, PostLineData } from '../state/buffer';
import { appReducer } from '../state/reducer';
import { bufferFor } from '../state/selectors';
import { AppStateProvider } from '../state/StateContext';
import { notification, status } from '../test/fixtures';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const ORIGIN = 'https://wired.example';
const ACCOUNT_KEY = `${ORIGIN}#acct-1`;
/** A moment whose clock reads the same in every timezone: local 23:04. */
const DATE = new Date(2026, 0, 2, 23, 4);

/** The account the window under test belongs to. */
const ACCOUNT: StoredAccount = {
  key: ACCOUNT_KEY,
  origin: ORIGIN,
  accountId: 'acct-1',
  handle: 'lain@wired.example',
  token: 'never-logged',
};

/** The home window on {@link ACCOUNT}, and the id its ref names. */
const REF: WindowRef = { kind: 'home', accountKey: ACCOUNT_KEY, target: null };
const HOME = windowId(REF);

/** A status carrying a content warning, for the reveal tests. */
const WARNED: Status = status('cw', {
  spoiler_text: 'lain spoilers',
  content: '<p>the fourth wall</p>',
});

/** The signed-in app state with the home window open. */
function opened(): AppState {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT_KEY,
  });
  return coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: REF, title: 'home' },
  });
}

/** The home buffer with one line of each kind: a post, a notification, a message. */
function seeded(posts: readonly Status[] = [status('a')]): AppState {
  const shown = appReducer(opened(), {
    type: 'statuses',
    windowId: HOME,
    statuses: posts,
    where: 'newer',
  });
  const notified = appReducer(shown, {
    type: 'notifications',
    windowId: HOME,
    notifications: [notification('n1', null)],
    where: 'newer',
  });
  return appReducer(notified, {
    type: 'print',
    windowId: HOME,
    date: DATE,
    level: 'warn',
    text: 'no more history',
  });
}

/** The first line of {@link kind} in the home buffer; the setup fails without one. */
function lineOf(state: AppState, kind: LineData['kind']): LineData {
  const line = bufferFor(state, HOME).lines.find((entry) => entry.kind === kind);
  if (line === undefined) {
    throw new Error(`the home buffer holds no ${kind} line`);
  }
  return line;
}

/** Render one line of the home window over {@link state}. */
function renderLine(state: AppState, line: LineData) {
  return render(
    <AppStateProvider initial={state}>
      <LineView line={line} windowId={HOME} />
    </AppStateProvider>,
  );
}

describe(LineView, () => {
  it('prints a client message with its level and the settings clock', () => {
    const state = seeded();

    const { container } = renderLine(state, lineOf(state, 'system'));

    expect(container.textContent).toBe('23:04 *** Warning: no more history');
  });

  it('follows the clock format the reader has set', () => {
    const state = appReducer(seeded(), { type: 'settings', settings: { clockFormat: '12h' } });

    const { container } = renderLine(state, lineOf(state, 'system'));

    expect(container.textContent).toBe('11:04pm *** Warning: no more history');
  });

  it('shows a post as the row its window labelled', () => {
    const state = seeded();

    renderLine(state, lineOf(state, 'post'));

    expect(
      screen.getByRole('article', { name: 'Post a0 by @lain@wired.example' }),
    ).toBeInTheDocument();
    expect(screen.getByText('[a0]')).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
  });

  it('selects the post its row was clicked on', () => {
    const state = seeded();

    renderLine(state, lineOf(state, 'post'));

    expect(screen.getByRole('article')).not.toHaveAttribute('aria-current');

    fireEvent.click(screen.getByText('[a0]'));

    expect(screen.getByRole('article')).toHaveAttribute('aria-current', 'true');
  });

  it('keeps the content behind a content warning hidden until asked', () => {
    const state = seeded([WARNED]);

    renderLine(state, lineOf(state, 'post'));

    expect(screen.queryByText('the fourth wall')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '[CW: lain spoilers]' }));

    expect(screen.getByText('the fourth wall')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '[CW: lain spoilers]' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('starts with the warning open when the buffer says so', () => {
    const revealed = appReducer(seeded([WARNED]), {
      type: 'toggleReveal',
      windowId: HOME,
      key: 'post:cw',
    });

    renderLine(revealed, lineOf(revealed, 'post'));

    expect(screen.getByText('the fourth wall')).toBeInTheDocument();
  });

  it('marks the row selected before it is rendered', () => {
    const chosen = appReducer(seeded(), { type: 'select', windowId: HOME, key: 'post:a' });

    renderLine(chosen, lineOf(chosen, 'post'));

    expect(screen.getByRole('article')).toHaveAttribute('aria-current', 'true');
  });

  it('leaves the nick click to the ticket that opens profiles', () => {
    const state = seeded();

    renderLine(state, lineOf(state, 'post'));

    fireEvent.click(screen.getByRole('button', { name: '@lain@wired.example' }));

    expect(screen.getByRole('article')).not.toHaveAttribute('aria-current');
  });

  it('prints a notification as the message naming who did what', () => {
    const state = seeded();

    const { container } = renderLine(state, lineOf(state, 'notification'));

    expect(container.textContent).toMatch(/^\d\d:\d\d \*\*\* @lain@wired\.example follow$/u);
  });

  it('falls back to no viewer once the window has lost its account', () => {
    const orphaned = appReducer(seeded(), { type: 'accounts', accounts: [], activeKey: null });

    renderLine(orphaned, lineOf(orphaned, 'post'));

    expect(
      screen.getByRole('article', { name: 'Post a0 by @lain@wired.example' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '@lain@wired.example' })).toBeInTheDocument();
  });

  it('shows no label for a status this window never labelled', () => {
    const ghost: PostLineData = { kind: 'post', key: 'post:ghost', status: status('ghost') };

    const { container } = renderLine(seeded(), ghost);

    expect(screen.getByText('[]')).toBeInTheDocument();
    expect(container.textContent).toMatch(/^\[\] \d\d:\d\d <lain@wired\.example> ghost$/u);
  });
});
