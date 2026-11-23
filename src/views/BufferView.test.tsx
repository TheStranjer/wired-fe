/**
 * Tests for the shared scrollback: one window's lines in buffer order inside a
 * single labelled log region, a window no buffer answers for rendering an empty
 * region, a click on a row inside the scrollback moving that window's own
 * selection through the reducer the provider holds, the row the selection
 * moves onto being the only one kept in view, and scrolling to the very top
 * asking that window's buffer for older posts.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BufferView } from './BufferView';
import type { StoredAccount } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import { type AppState, coreReducer, initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { bufferFor } from '../state/selectors';
import { AppStateProvider, useAppState } from '../state/StateContext';
import { notification, status } from '../test/fixtures';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const ORIGIN = 'https://wired.example';
/** A moment whose clock reads the same in every timezone: local 23:04. */
const DATE = new Date(2026, 0, 2, 23, 4);

/** The account the window under test belongs to. */
const ACCOUNT: StoredAccount = {
  key: `${ORIGIN}#acct-1`,
  origin: ORIGIN,
  accountId: 'acct-1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** The notifications window on {@link ACCOUNT}, and the id its ref names. */
const REF: WindowRef = { kind: 'notifications', accountKey: ACCOUNT.key, target: null };
const WINDOW = windowId(REF);

/** A status carrying a content warning, for the reveal test. */
const WARNED: Status = status('cw', {
  spoiler_text: 'lain spoilers',
  content: '<p>the fourth wall</p>',
});

/** The signed-in app state with {@link WINDOW} open. */
function opened(): AppState {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT.key,
  });
  return coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: REF, title: 'notifications' },
  });
}

/** Its buffer, holding a message, a post and a notification, oldest first. */
function seeded(posts: readonly Status[] = [status('a')]): AppState {
  const shown = appReducer(opened(), {
    type: 'print',
    windowId: WINDOW,
    date: DATE,
    level: 'info',
    text: 'connected to wired.example',
  });
  const posted = appReducer(shown, {
    type: 'statuses',
    windowId: WINDOW,
    statuses: posts,
    where: 'newer',
  });
  return appReducer(posted, {
    type: 'notifications',
    windowId: WINDOW,
    notifications: [notification('n1', null)],
    where: 'newer',
  });
}

/** The window's older-request count, as a line a test can read. */
function OlderRequests() {
  const { olderRequests } = bufferFor(useAppState(), WINDOW);
  return <span>{`older requests: ${String(olderRequests)}`}</span>;
}

/** Show {@link state}'s scrollback for the window {@link at}, with its ask counter. */
function renderBuffer(state: AppState, at = WINDOW) {
  return render(
    <AppStateProvider initial={state}>
      <BufferView label="notifications" windowId={at} />
      <OlderRequests />
    </AppStateProvider>,
  );
}

describe(BufferView, () => {
  it('is one labelled log region holding the window lines in order', () => {
    renderBuffer(seeded());

    const log = screen.getByRole('log', { name: 'notifications' });
    const lines = Array.from(log.children, (line) => line.textContent);

    expect(lines).toStrictEqual([
      '23:04 *** connected to wired.example',
      expect.stringMatching(/^\[a0\] \d\d:\d\d <lain@wired\.example> a$/u),
      expect.stringMatching(/^\d\d:\d\d \*\*\* @lain@wired\.example followed you$/u),
    ]);
  });

  it('shows an empty region for a window no buffer answers for', () => {
    renderBuffer(seeded(), 'notifications:nobody:nothing');

    expect(screen.getByRole('log', { name: 'notifications' })).toBeEmptyDOMElement();
  });

  it('moves its window selection when a row in it is clicked', () => {
    renderBuffer(seeded());

    const row = screen.getByRole('article', { name: 'Post a0 by @lain@wired.example' });

    expect(row).not.toHaveAttribute('aria-current');

    fireEvent.click(screen.getByText('[a0]'));

    expect(screen.getByRole('article')).toHaveAttribute('aria-current', 'true');
  });

  it('keeps the row the selection moved onto in view, and only that row', () => {
    renderBuffer(seeded([status('b'), status('a')]));

    const scrolls = screen.getAllByRole('article').map((row) => {
      const scrollIntoView = vi.fn();
      Object.defineProperty(row, 'scrollIntoView', {
        configurable: true,
        writable: true,
        value: scrollIntoView,
      });
      return scrollIntoView;
    });

    fireEvent.click(screen.getByText('[a1]'));

    expect(scrolls[1]).toHaveBeenCalledWith({ block: 'nearest' });
    expect(scrolls[0]).not.toHaveBeenCalled();
  });

  it('opens the warning of a row inside the scrollback', () => {
    renderBuffer(seeded([WARNED]));

    expect(screen.queryByText('the fourth wall')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '[CW: lain spoilers]' }));

    expect(screen.getByText('the fourth wall')).toBeInTheDocument();
  });

  it('asks its window for older posts when the scrollback reaches the top', () => {
    renderBuffer(seeded());

    expect(screen.getByText('older requests: 0')).toBeInTheDocument();

    fireEvent.scroll(screen.getByRole('log', { name: 'notifications' }));

    expect(screen.getByText('older requests: 1')).toBeInTheDocument();
  });

  it('asks again for every scroll to the top', () => {
    renderBuffer(seeded());

    const log = screen.getByRole('log', { name: 'notifications' });
    fireEvent.scroll(log);
    fireEvent.scroll(log);

    expect(screen.getByText('older requests: 2')).toBeInTheDocument();
  });
});
