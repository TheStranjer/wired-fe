/**
 * Tests for qualified hash routes (decision 4): `#/<host>/notice/<id>` opens
 * for the active account when it is on that origin, else for the first
 * signed-in account on it; with no account on that origin one info line names
 * the host, the hash stays in the address bar, and the route opens once such
 * an account appears. An unqualified route still opens for the active account.
 */
import { act, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { useHashRoute } from './useHashRoute';
import { type StoredAccount, accountKey } from '../accounts/accountStore';
import { ALLY, LAIN, mountRouter, statusLines, titles, visit } from '../test/hashRoute';
import { server } from '../test/server';

/** An account on `https://b.example`, the instance lain is not signed in to. */
const BOB: StoredAccount = {
  ...LAIN,
  key: accountKey('https://b.example', '9'),
  origin: 'https://b.example',
  accountId: '9',
  handle: 'bob@b.example',
};

/** The router mounted with lain active and bob (on another instance) also signed in. */
function mountBoth(): ReturnType<typeof mountRouter> {
  return mountRouter(useHashRoute, true, [
    { type: 'accounts', accounts: [LAIN, BOB], activeKey: LAIN.key },
  ]);
}

describe('useHashRoute with a qualified route', () => {
  afterEach(() => {
    visit('/');
  });

  it('opens for the active account when it is on the route origin', () => {
    visit('/#/wired.example/notice/abc');

    const { result } = mountBoth();

    expect(result.current.state.windows.activeId).toBe(`thread:${LAIN.key}:abc`);
    expect(window.location.hash).toBe('');
  });

  it('opens for a signed-in account that is not active when it is on the route origin', () => {
    visit('/#/b.example/notice/abc');

    const { result } = mountBoth();

    expect(titles(result.current.state)).toStrictEqual(['status', 'thread/abc']);
    expect(result.current.state.windows.activeId).toBe(`thread:${BOB.key}:abc`);
    expect(window.location.hash).toBe('');
  });

  it('reads a user id with the session of the account on the route origin', async () => {
    const asked: string[] = [];
    server.use(
      http.get('https://b.example/api/v1/accounts/55', ({ request }) => {
        asked.push(request.headers.get('authorization') ?? '');
        return HttpResponse.json(ALLY);
      }),
    );
    visit('/#/b.example/users/55');

    const { result } = mountBoth();

    await waitFor(() => {
      expect(titles(result.current.state)).toStrictEqual(['status', '@ally@x.example']);
    });

    expect(result.current.state.windows.activeId).toBe(`profile:${BOB.key}:55`);
    expect(asked).toStrictEqual([`Bearer ${BOB.token}`]);
  });

  it('prints one line naming the host and keeps the hash with no account on that origin', () => {
    visit('/#/c.example/tag/Rust');

    const { result } = mountBoth();

    expect(titles(result.current.state)).toStrictEqual(['status']);
    expect(statusLines(result.current.state)).toStrictEqual([
      'Not signed in to c.example. Type /connect to log in there.',
    ]);
    expect(window.location.hash).toBe('#/c.example/tag/Rust');
  });

  it('names the host with its port and prints the same line with nobody signed in', () => {
    visit('/#/localhost:4000/notice/1');

    const { result } = mountRouter(useHashRoute, true, []);

    expect(statusLines(result.current.state)).toStrictEqual([
      'Not signed in to localhost:4000. Type /connect to log in there.',
    ]);
    expect(window.location.hash).toBe('#/localhost:4000/notice/1');
  });

  it('opens the kept route when an account on that origin signs in', () => {
    visit('/#/b.example/tag/Rust');
    const { result } = mountRouter(useHashRoute, true);

    act(() => {
      result.current.dispatch({
        type: 'accounts',
        accounts: [LAIN, BOB],
        activeKey: LAIN.key,
      });
    });

    expect(titles(result.current.state)).toStrictEqual(['status', '#rust']);
    expect(result.current.state.windows.activeId).toBe(`hashtag:${BOB.key}:rust`);
    expect(statusLines(result.current.state)).toHaveLength(1);
    expect(window.location.hash).toBe('');
  });

  it('still opens an unqualified route for the active account', () => {
    visit('/#/notice/abc');

    const { result } = mountBoth();

    expect(result.current.state.windows.activeId).toBe(`thread:${LAIN.key}:abc`);
    expect(statusLines(result.current.state)).toStrictEqual([]);
  });
});
