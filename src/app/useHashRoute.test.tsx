/**
 * Tests for the hash router (decision 4): once startup is done the address
 * bar's route opens its window for the active account — `#/notice/abc` a
 * thread, `#/@ally@x.example` and `#/users/55` her profile, `#/tag/Rust`
 * `#rust` — and leaves the address bar without
 * the hash; nothing opens before startup is done. The accounts are answered
 * over MSW; what the router does with nobody signed in, with a `hashchange`
 * and with a failed lookup is in useHashRoute.events.test.tsx. A route always
 * opens `here` (WFE-238), whatever `openIn` and `openInByKind` say.
 */
import { waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { useHashRoute } from './useHashRoute';
import { ALLY, LAIN, ORIGIN, mountRouter, titles, visit } from '../test/hashRoute';
import { server } from '../test/server';
import { activeDesktop, focusedWindowId } from '../windows/desktops';

/** The router mounted over lain's session, {@link ready} or not. */
function mount(ready: boolean): ReturnType<typeof mountRouter> {
  return mountRouter(useHashRoute, ready);
}

describe(useHashRoute, () => {
  afterEach(() => {
    visit('/');
  });

  it('opens the thread window of #/notice/<id> and takes the hash away', () => {
    visit('/?q=1#/notice/abc');

    const { result } = mount(true);

    expect(titles(result.current.state)).toStrictEqual(['status', 'thread/abc']);
    expect(result.current.state.windows.activeId).toBe(`thread:${LAIN.key}:abc`);
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?q=1');
  });

  it('opens a route here, in the focused pane, whatever the placement settings say', () => {
    visit('/#/notice/abc');

    const { result } = mountRouter(useHashRoute, true, [
      { type: 'accounts', accounts: [LAIN], activeKey: LAIN.key },
      { type: 'settings', settings: { openIn: 'float', openInByKind: { thread: 'vsplit' } } },
    ]);

    const desktop = activeDesktop(result.current.state.layout);

    expect(desktop.floats).toStrictEqual([]);
    expect(desktop.tree?.type).toBe('pane');
    expect(focusedWindowId(result.current.state.layout)).toBe(`thread:${LAIN.key}:abc`);
  });

  it('opens the profile window of #/@acct after looking her up', async () => {
    const asked: string[] = [];
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/lookup`, ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('acct') ?? '');
        return HttpResponse.json(ALLY);
      }),
    );
    visit('/#/@ally@x.example');

    const { result } = mount(true);

    await waitFor(() => {
      expect(titles(result.current.state)).toStrictEqual(['status', '@ally@x.example']);
    });

    expect(result.current.state.windows.activeId).toBe(`profile:${LAIN.key}:55`);
    expect(asked).toStrictEqual(['ally@x.example']);
    expect(window.location.hash).toBe('');
  });

  it('opens the profile window of #/users/<id> after fetching her', async () => {
    server.use(http.get(`${ORIGIN}/api/v1/accounts/55`, () => HttpResponse.json(ALLY)));
    visit('/#/users/55');

    const { result } = mount(true);

    await waitFor(() => {
      expect(titles(result.current.state)).toStrictEqual(['status', '@ally@x.example']);
    });
  });

  it('opens the lowercased hashtag window of #/tag/<name>', () => {
    visit('/#/tag/Rust');

    const { result } = mount(true);

    expect(titles(result.current.state)).toStrictEqual(['status', '#rust']);
    expect(result.current.state.windows.activeId).toBe(`hashtag:${LAIN.key}:rust`);
  });

  it('opens nothing until startup is done', () => {
    visit('/#/tag/rust');

    const { result, rerender } = mount(false);

    expect(titles(result.current.state)).toStrictEqual(['status']);
    expect(window.location.hash).toBe('#/tag/rust');

    rerender({ ready: true });

    expect(titles(result.current.state)).toStrictEqual(['status', '#rust']);
  });
});
