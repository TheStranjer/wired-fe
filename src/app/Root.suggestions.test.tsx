/**
 * Tests for the live suggestion list in the running shell (WFE-297): `/ho`
 * lists `/home` with its summary and `/hom` narrows it, aliases show beside the
 * main name, the list closes on a space after the name, on Escape and when the
 * caret leaves the word, Tab steps the highlight and keeps the list up, a click
 * on a row completes to it, and the input is a combobox that points at the
 * list. Startup is mocked; it has its own tests.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { initialAppState } from '../state/appState';
import { type AppAction, appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { server } from '../test/server';
import type { WindowRef } from '../windows/model';

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

/** A session signed in, with one home window. */
const SEED: readonly AppAction[] = [
  { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
  { type: 'windows', action: { type: 'open', ref: HOME, title: 'home' } },
];

/** The summaries the registry gives the two commands these tests list. */
const HOME_ROW = '/home — Open your home timeline';
const HELP_ROW = '/help (/h) — List commands, or show help for one';

/** Render Root over a signed-in session. */
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

/** Presses Tab — with Shift when told to. */
function tab(shiftKey = false): void {
  fireEvent.keyDown(line(), { key: 'Tab', shiftKey });
}

/** The names of the rows on show. */
function rows(): readonly string[] {
  return screen.queryAllByRole('option').map((option) => option.textContent);
}

/** The names of the rows highlighted. */
function selected(): readonly string[] {
  return screen.queryAllByRole('option', { selected: true }).map((option) => option.textContent);
}

/** Moves the caret to {@link at} the way the arrow keys would. */
function moveCaret(at: number): void {
  line().setSelectionRange(at, at);
  fireEvent.keyUp(line(), { key: 'ArrowLeft' });
}

describe('the suggestion list', () => {
  beforeEach(() => {
    server.use(
      http.get(`${ORIGIN}/api/v1/timelines/home`, () => HttpResponse.json([])),
      http.get(`${ORIGIN}/api/v1/custom_emojis`, () => HttpResponse.json([])),
    );
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  });

  it('lists a command with its summary as you type, narrowing as you go', () => {
    renderRoot();

    type('/ho');

    expect(rows()).toStrictEqual([HOME_ROW]);

    type('/h');

    expect(rows()).toStrictEqual([HELP_ROW, HOME_ROW]);

    type('/hom');

    expect(rows()).toStrictEqual([HOME_ROW]);
  });

  it('matches on an alias and shows it beside the main name', () => {
    renderRoot();

    type('/h');

    expect(screen.getByRole('option', { name: HELP_ROW })).toBeInTheDocument();
  });

  it('lists every command for a bare slash, with no count of the rest', () => {
    renderRoot();

    type('/');

    expect(screen.getAllByRole('option').length).toBeGreaterThan(8);
    expect(screen.queryByText(/^\+\d+ more$/u)).not.toBeInTheDocument();
  });

  it('scrolls the highlighted row into view as Tab cycles past the eighth', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    renderRoot();

    type('/');
    for (let step = 0; step < 40; step += 1) {
      tab();
    }

    const options = screen.getAllByRole('option');
    const chosen = options.findIndex((option) => option.getAttribute('aria-selected') === 'true');

    expect(chosen).toBeGreaterThan(8);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest' });
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(options[chosen]);
  });

  it('is not there for a line that is not a command', () => {
    renderRoot();

    type('hello');

    expect(rows()).toStrictEqual([]);

    type('@al');

    expect(rows()).toStrictEqual([]);
  });

  it('closes on a space after the name', () => {
    renderRoot();

    type('/home');

    expect(rows()).toStrictEqual([HOME_ROW]);

    type('/home ');

    expect(rows()).toStrictEqual([]);
  });

  it('closes on Escape', () => {
    renderRoot();

    type('/ho');
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(rows()).toStrictEqual([]);
    expect(line()).toHaveAttribute('aria-expanded', 'false');
  });

  it('follows the caret out of the word and back into it', () => {
    renderRoot();

    type('/ho');
    moveCaret(0);

    expect(rows()).toStrictEqual([]);

    moveCaret(2);

    expect(rows()).toStrictEqual([HELP_ROW, HOME_ROW]);
  });

  it('is a combobox that points at the list and its highlighted row', () => {
    renderRoot();

    type('/ho');

    expect(line()).toHaveAttribute('aria-expanded', 'true');
    expect(line()).toHaveAttribute(
      'aria-controls',
      screen.getByRole('listbox', { name: 'Command suggestions' }).id,
    );
    expect(line()).not.toHaveAttribute('aria-activedescendant');

    tab();

    expect(line()).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: HOME_ROW }).id,
    );
  });

  it('highlights the row of the candidate Tab put in the line and keeps the list up', () => {
    renderRoot();

    type('/h');
    tab();

    expect(line()).toHaveValue('/h ');
    expect(selected()).toStrictEqual([HELP_ROW]);

    tab();
    tab();

    expect(line()).toHaveValue('/home ');
    expect(selected()).toStrictEqual([HOME_ROW]);
  });

  it('steps the highlight back with Shift+Tab', () => {
    renderRoot();

    type('/h');
    tab();
    tab();
    tab();
    tab(true);

    expect(line()).toHaveValue('/help ');
    expect(selected()).toStrictEqual([HELP_ROW]);
  });

  it('goes back to the typed word when the line changes without a key', () => {
    renderRoot();

    type('/ho');
    tab();
    type('/hom');

    expect(rows()).toStrictEqual([HOME_ROW]);
    expect(screen.getByRole('option', { name: HOME_ROW })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('completes to the row that is clicked and closes', () => {
    renderRoot();

    type('/h');
    fireEvent.click(screen.getByRole('option', { name: HOME_ROW }));

    expect(line()).toHaveValue('/home ');
    expect(line()).toHaveFocus();
    expect(line().selectionStart).toBe('/home '.length);
    expect(rows()).toStrictEqual([]);
  });

  it('leaves the list out of the tab order and keeps focus in the input on a press', () => {
    renderRoot();

    type('/ho');

    const row = screen.getByRole('option', { name: HOME_ROW });

    expect(row).toHaveAttribute('tabindex', '-1');
    expect(fireEvent.mouseDown(row)).toBe(false);
  });
});
