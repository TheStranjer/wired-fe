/**
 * Tests for what the hash router does around the happy path (decision 4):
 * with nobody signed in the `/connect` hint is printed, the hash is kept and
 * the route opens when an account appears; a `hashchange` opens a second
 * window; the listener goes with the hook; a lookup that fails prints why and
 * opens nothing; and a hash that is no route is left alone.
 */
import { act, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import type { PublicConfig } from './publicRoute';
import { useHashRoute } from './useHashRoute';
import type { AppAction } from '../state/reducer';
import { LAIN, ORIGIN, mountRouter, statusLines, titles, visit } from '../test/hashRoute';
import { server } from '../test/server';

/** The build with public view off; one object, since the router's effect reruns when its config changes. */
const CLOSED: PublicConfig = { instances: { mode: 'same-origin' }, publicView: false };

/** The router of a build with public view off, so nobody signed in gets the hint (WFE-340). */
function useClosedRouter(ready: boolean): void {
  useHashRoute(ready, CLOSED);
}

/** The router mounted over lain's session, or over the state {@link actions} lead to. */
function mount(ready: boolean, actions?: readonly AppAction[]): ReturnType<typeof mountRouter> {
  return mountRouter(useClosedRouter, ready, actions);
}

describe(useHashRoute, () => {
  afterEach(() => {
    visit('/');
  });

  it('prints the /connect hint with nobody signed in and keeps the hash', () => {
    visit('/#/tag/Rust');

    const { result } = mount(true, []);

    expect(titles(result.current.state)).toStrictEqual(['status']);
    expect(statusLines(result.current.state)).toStrictEqual([
      'Not connected. Type /connect to log in.',
    ]);
    expect(window.location.hash).toBe('#/tag/Rust');
  });

  it('opens the kept route when an account appears', () => {
    visit('/#/tag/Rust');
    const { result } = mount(true, []);

    act(() => {
      result.current.dispatch({ type: 'accounts', accounts: [LAIN], activeKey: LAIN.key });
    });

    expect(titles(result.current.state)).toStrictEqual(['status', '#rust']);
    expect(statusLines(result.current.state)).toHaveLength(1);
    expect(window.location.hash).toBe('');
  });

  it('opens a second window on a hashchange', () => {
    visit('/#/tag/rust');
    const { result } = mount(true);

    act(() => {
      visit('/#/notice/abc');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(titles(result.current.state)).toStrictEqual(['status', '#rust', 'thread/abc']);
    expect(window.location.hash).toBe('');
  });

  it('stops listening for hashchange when it unmounts', () => {
    const { result, unmount } = mount(true);
    unmount();

    visit('/#/tag/rust');
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(titles(result.current.state)).toStrictEqual(['status']);
    expect(window.location.hash).toBe('#/tag/rust');
  });

  it('prints why an account could not be found and opens nothing', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/lookup`, () =>
        HttpResponse.json({ error: 'Record not found' }, { status: 404 }),
      ),
    );
    visit('/#/@nobody');

    const { result } = mount(true);

    await waitFor(() => {
      expect(statusLines(result.current.state)).toHaveLength(1);
    });

    expect(statusLines(result.current.state)[0]).toMatch(/^HTTP 404/u);
    expect(titles(result.current.state)).toStrictEqual(['status']);
  });

  it('leaves a hash that is no route alone', () => {
    visit('/#/junk');

    const { result } = mount(true);

    expect(titles(result.current.state)).toStrictEqual(['status']);
    expect(window.location.hash).toBe('#/junk');
  });
});
