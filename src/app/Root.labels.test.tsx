/**
 * Tests for post-label completion in the running shell (WFE-301): `/fav a`
 * lists the active window's labels with their authors, `/fav ` alone lists
 * them all, Tab completes `/fav a2 ` and cycles on, a click on a row
 * completes to it, a `[` word completes to the bracketed label anywhere, and
 * a command that takes no post is left to the command provider. Startup is
 * mocked; it has its own tests.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { initialAppState } from '../state/appState';
import { type AppAction, appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { status } from '../test/fixtures';
import { server } from '../test/server';
import { type WindowRef, windowId } from '../windows/model';

vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

const ORIGIN = 'https://wired.example';

const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'not-a-real-token',
  refreshToken: null,
  expiresAt: null,
};

/** The home window the tests open. */
const HOME: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };

/** Three posts, newest first as the API gives them: labelled `a2`, `a1`, `a0`. */
const POSTS = [
  status('c', { content: '<p>third</p>' }),
  status('b', { content: '<p>second</p>' }),
  status('a', { content: '<p>first</p>' }),
];

/** A session signed in, with one home window showing {@link POSTS}. */
const SEED: readonly AppAction[] = [
  { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
  { type: 'windows', action: { type: 'open', ref: HOME, title: 'home' } },
  { type: 'statuses', windowId: windowId(HOME), statuses: POSTS, where: 'newer' },
];

/** The rows the three posts make, newest first. */
const ROWS = [
  'a2 — <@lain@wired.example> third',
  'a1 — <@lain@wired.example> second',
  'a0 — <@lain@wired.example> first',
];

/** Render Root over the signed-in session. */
function renderRoot(): void {
  render(
    <AppStateProvider initial={SEED.reduce(appReducer, initialAppState())}>
      <Root />
    </AppStateProvider>,
  );
}

/** The command line. */
function line(): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>('combobox', { name: 'Command line' });
}

/** Shows {@link text} on the command line, as typing it would. */
function type(text: string): void {
  fireEvent.change(line(), { target: { value: text } });
}

/** Presses Tab. */
function tab(): void {
  fireEvent.keyDown(line(), { key: 'Tab' });
}

/** The names of the rows on show. */
function rows(): readonly string[] {
  return screen.queryAllByRole('option').map((option) => option.textContent);
}

describe('post label completion', () => {
  beforeEach(() => {
    server.use(
      http.get(`${ORIGIN}/api/v1/timelines/home`, () => HttpResponse.json([])),
      http.get(`${ORIGIN}/api/v1/custom_emojis`, () => HttpResponse.json([])),
    );
  });

  it('lists the labels with their authors as the argument is typed', () => {
    renderRoot();

    type('/fav a');

    expect(rows()).toStrictEqual(ROWS);

    type('/fav a1');

    expect(rows()).toStrictEqual([ROWS[1]]);
  });

  it('lists every label right after the command and a space', () => {
    renderRoot();

    type('/fav ');

    expect(rows()).toStrictEqual(ROWS);
  });

  it('completes the newest label on Tab and cycles on with the highlight', () => {
    renderRoot();

    type('/fav a');
    tab();

    expect(line()).toHaveValue('/fav a2 ');
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(ROWS[0] ?? '');

    tab();

    expect(line()).toHaveValue('/fav a1 ');
  });

  it('fills a label into an empty argument on Tab', () => {
    renderRoot();

    type('/fav ');
    tab();

    expect(line()).toHaveValue('/fav a2 ');
  });

  it('completes to the row that is clicked', () => {
    renderRoot();

    type('/reply a');
    fireEvent.click(screen.getByRole('option', { name: ROWS[2] ?? '' }));

    expect(line()).toHaveValue('/reply a0 ');
    expect(rows()).toStrictEqual([]);
  });

  it('completes a word typed with a bracket to the bracketed label, in any line', () => {
    renderRoot();

    type('look at [a');
    tab();

    expect(line()).toHaveValue('look at [a2] ');
  });

  it('works through an alias of the command', () => {
    renderRoot();

    type('/f a0');

    expect(rows()).toStrictEqual([ROWS[2]]);
  });

  it('leaves a command that takes no post to the command provider', () => {
    renderRoot();

    type('/home a');

    expect(rows()).toStrictEqual([]);

    type('/ho');

    expect(rows()).toStrictEqual(['/home — Open your home timeline']);
  });

  it('offers nothing when the window has no labels', () => {
    render(
      <AppStateProvider initial={SEED.slice(0, 2).reduce(appReducer, initialAppState())}>
        <Root />
      </AppStateProvider>,
    );

    type('/fav ');

    expect(rows()).toStrictEqual([]);
  });
});
