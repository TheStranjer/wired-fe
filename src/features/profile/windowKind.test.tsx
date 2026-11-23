/**
 * Tests for the profile window kind: the definition it self-registers, its
 * topic line the `@<acct>` the window is titled with, and no post handler at
 * all; its component shows the account's whois block (fetched over MSW, above)
 * over a log region named for the account and paged from that account's
 * statuses endpoint — first page in, older pages asked for at the top — and
 * an unopened window fetches nothing.
 */
import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import { accountKey, type StoredAccount } from '../../accounts/accountStore';
import { type AppState, coreReducer, initialAppState } from '../../state/appState';
import { AppStateProvider } from '../../state/StateContext';
import { status, TEST_DATE } from '../../test/fixtures';
import { server } from '../../test/server';
import { activeWindow, windowId } from '../../windows/model';
import type { WindowRef } from '../../windows/model';

const ORIGIN = 'https://wired.example';

/** The signed-in account, and nine's profile window on it. */
const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};
const REF: WindowRef = { kind: 'profile', accountKey: ACCOUNT.key, target: '9' };
const WINDOW = windowId(REF);

/** Nine, as both the account endpoint and the posts' author answer. */
const NINE_WIRE = {
  id: '9',
  username: 'nine',
  acct: 'nine@pleroma.example',
  display_name: 'Nine',
  created_at: TEST_DATE,
  note: '<p>not lain</p>',
  url: 'https://pleroma.example/@nine',
  avatar: 'https://pleroma.example/avi.png',
  header: 'https://pleroma.example/banner.png',
  followers_count: 300,
  following_count: 80,
  statuses_count: 120,
};

/** The one post nine's timeline answers with. */
const POST = status('7', { content: '<p>present day</p>', account: NINE_WIRE });

/** The signed-in session with nine's profile window open. */
function opened(): AppState {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT.key,
  });
  return coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: REF, title: '@nine@pleroma.example' },
  });
}

/** Serve the whois pair and nine's statuses. */
function serveProfile(): void {
  server.use(
    http.get(`${ORIGIN}/api/v1/accounts/9`, () => {
      return HttpResponse.json(NINE_WIRE);
    }),
    http.get(`${ORIGIN}/api/v1/accounts/relationships`, () => {
      return HttpResponse.json([{ id: '9', following: true }]);
    }),
    http.get(`${ORIGIN}/api/v1/accounts/9/statuses`, ({ request }) => {
      const url = new URL(request.url);

      expect(url.pathname).toBe('/api/v1/accounts/9/statuses');
      expect(url.searchParams.get('limit')).toBe('40');

      return HttpResponse.json([POST]);
    }),
  );
}

/** Show the kind's component for the window with {@link id} over {@link state}. */
function renderProfile(state: AppState, id: string): void {
  const { Component } = windowKind;
  render(
    <AppStateProvider initial={state}>
      <Component windowId={id} />
    </AppStateProvider>,
  );
}

describe('the profile window kind', () => {
  it('is the definition for the profile kind, topics @<acct> and takes no posts', () => {
    const state = opened();

    expect(windowKind.kind).toBe('profile');
    expect(windowKind.Component).toBeTypeOf('function');
    expect(windowKind.onPost).toBeUndefined();
    expect(windowKind.topic(activeWindow(state.windows), state)).toBe('@nine@pleroma.example');
  });

  it('shows the whois block above a log region named for the account', async () => {
    serveProfile();
    renderProfile(opened(), WINDOW);

    const log = await screen.findByRole('log', { name: '@nine@pleroma.example' });

    expect(log).toHaveTextContent('present day');
    expect(screen.getByText('Nine (@nine@pleroma.example)')).toBeInTheDocument();
    expect(screen.getByText('not lain')).toBeInTheDocument();
    expect(
      screen.getByText('posts 120 · following 80 · followers 300 · joined 2026-11-12'),
    ).toBeInTheDocument();
    expect(screen.getByText('you follow them')).toBeInTheDocument();
  });

  it('names an unopened window’s log region plainly and fetches nothing', () => {
    renderProfile(opened(), 'profile:never:opened');

    expect(screen.getByRole('log', { name: 'profile' })).toBeEmptyDOMElement();
  });
});
