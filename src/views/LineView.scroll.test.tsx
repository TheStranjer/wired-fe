/**
 * Tests for the view keeping a window's selection in view: the row the
 * selection moves onto is scrolled to the nearest edge, and a DOM that
 * implements no scrollIntoView — jsdom — is survived.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { type Mock, describe, expect, it, vi } from 'vitest';

import { LineView } from './LineView';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { bufferFor } from '../state/selectors';
import { AppStateProvider } from '../state/StateContext';
import { status } from '../test/fixtures';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const ORIGIN = 'https://wired.example';
const ACCOUNT_KEY = `${ORIGIN}#acct-1`;

/** The home window on the one signed-in account, and the id its ref names. */
const REF: WindowRef = { kind: 'home', accountKey: ACCOUNT_KEY, target: null };
const HOME = windowId(REF);

/** The signed-in app state with the home window showing two posts, a0 and a1. */
function seeded(): AppState {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [
      {
        key: ACCOUNT_KEY,
        origin: ORIGIN,
        accountId: 'acct-1',
        handle: 'lain@wired.example',
        token: 'never-logged',
      },
    ],
    activeKey: ACCOUNT_KEY,
  });
  const opened = coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: REF, title: 'home' },
  });
  return appReducer(opened, {
    type: 'statuses',
    windowId: HOME,
    statuses: [status('b'), status('a')],
    where: 'newer',
  });
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

/** Render the home window's lines over {@link state}, oldest first. */
function renderLines(state: AppState): void {
  render(
    <AppStateProvider initial={state}>
      {bufferFor(state, HOME).lines.map((line) => (
        <LineView key={line.key} line={line} windowId={HOME} />
      ))}
    </AppStateProvider>,
  );
}

describe('LineView selection scrolling', () => {
  it('scrolls the row into view when the selection moves onto it', () => {
    const state = seeded();
    renderLines(state);

    const row = screen.getByRole('article', { name: 'Post a0 by @lain@wired.example' });
    const scrollIntoView = fakeScrollIntoView(row);

    fireEvent.click(screen.getByText('[a0]'));

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('survives a selection change on a DOM without scrollIntoView', () => {
    const state = seeded();
    renderLines(state);

    const row = screen.getByRole('article', { name: 'Post a0 by @lain@wired.example' });

    expect(row).not.toHaveProperty('scrollIntoView');

    fireEvent.click(screen.getByText('[a0]'));

    expect(screen.getByRole('article', { name: 'Post a0 by @lain@wired.example' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(
      screen.getByRole('article', { name: 'Post a1 by @lain@wired.example' }),
    ).not.toHaveAttribute('aria-current');
  });
});
