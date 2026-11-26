/**
 * Tests for the notifications window kind: the definition it self-registers —
 * kind, component and `onPost`, which posts as the account without entering
 * the list — the topic line it shows, and that its component pages the account's
 * notification list into its own scrollback: mentions as their posts, the rest
 * as client messages, with the list asked for at the loader's page size.
 */
import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import { accountKey, type StoredAccount } from '../../accounts/accountStore';
import { type AppState, coreReducer, initialAppState } from '../../state/appState';
import { AppStateProvider } from '../../state/StateContext';
import { notification, status } from '../../test/fixtures';
import { runKindPost } from '../../test/kindPost';
import { server } from '../../test/server';
import { NOTIFICATIONS_PAGE_SIZE } from '../../views/useNotifications';
import { activeWindow, windowId } from '../../windows/model';
import type { WindowRef } from '../../windows/model';

const ORIGIN = 'https://wired.example';
const LIST_URL = `${ORIGIN}/api/v1/notifications`;

/** The session's one account, and the notifications window it owns. */
const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};
const NOTIFICATIONS: WindowRef = { kind: 'notifications', accountKey: ACCOUNT.key, target: null };
const WINDOW = windowId(NOTIFICATIONS);

/** What the list answers with: a mention and a follow, newest first. */
const MENTION = notification('7', status('5', { content: '<p>present day</p>' }));
const FOLLOW = notification('9', null);

/** A signed-in session with its notifications window open. */
function opened(): AppState {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT.key,
  });
  return coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: NOTIFICATIONS, title: 'notifs' },
  });
}

/** Show the kind's component over the state {@link state}. */
function renderNotifs(state: AppState): void {
  const { Component } = windowKind;
  render(
    <AppStateProvider initial={state}>
      <Component windowId={WINDOW} />
    </AppStateProvider>,
  );
}

describe('the notifications window kind', () => {
  it('is the definition for the notifications kind, and it takes posts', () => {
    expect(windowKind.kind).toBe('notifications');
    expect(windowKind.Component).toBeTypeOf('function');
    expect(windowKind.onPost).toBeTypeOf('function');
  });

  it('topics its window as notifications', () => {
    const state = opened();

    expect(windowKind.topic(activeWindow(state.windows), state)).toBe('notifications');
  });

  it('fills a log region named notifications with the list’s first page', async () => {
    server.use(
      http.get(LIST_URL, ({ request }) => {
        const url = new URL(request.url);

        expect(url.searchParams.get('limit')).toBe(String(NOTIFICATIONS_PAGE_SIZE));

        return HttpResponse.json([FOLLOW, MENTION]);
      }),
    );

    renderNotifs(opened());

    const log = await screen.findByRole('log', { name: 'notifications' });

    expect(log).toHaveTextContent('present day');
    expect(log).toHaveTextContent('followed you');
  });

  it('posts as its window’s account, not into the buffer, and confirms it', async () => {
    const state = opened();
    const win = activeWindow(state.windows);

    const run = await runKindPost(windowKind, { state, win, origin: ORIGIN }, 'sup');

    expect(run.result).toBeNull();
    expect(run.bodies).toStrictEqual([{ status: 'sup', visibility: 'public' }]);
    expect(run.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'statuses' }));
    expect(run.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'print', text: 'posted as @lain@wired.example' }),
    );
  });

  it('resolves the API error when the post is refused', async () => {
    const state = opened();
    const win = activeWindow(state.windows);

    const run = await runKindPost(windowKind, { state, win, origin: ORIGIN, refused: true }, 'sup');

    expect(run.result).toBe('HTTP 422: Text is too long');
  });
});
