/**
 * Tests for the hash router's remote follow and interaction route (decision
 * 4): `#/authorize_interaction?uri=<v>` is searched on the active account's
 * instance with `resolve=true` and one result. A handle opens the account's
 * profile window with the `/follow` hint printed into it, a post URL opens its
 * thread window, no result (or a failed search) prints that nothing was
 * found, and with nobody signed in the hint and the hash are kept. The search
 * is answered over MSW.
 */
import { act, waitFor } from '@testing-library/react';
import { HttpResponse, type JsonBodyType, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { useHashRoute } from './useHashRoute';
import { bufferFor } from '../state/selectors';
import { status } from '../test/fixtures';
import { ALLY, LAIN, ORIGIN, mountRouter, statusLines, titles, visit } from '../test/hashRoute';
import { server } from '../test/server';

/** Answers every search with {@link body}, recording the queries asked. */
function serveSearch(body: JsonBodyType): URLSearchParams[] {
  const asked: URLSearchParams[] = [];
  server.use(
    http.get(`${ORIGIN}/api/v2/search`, ({ request }) => {
      asked.push(new URL(request.url).searchParams);
      return HttpResponse.json(body);
    }),
  );
  return asked;
}

describe('remote interaction route', () => {
  afterEach(() => {
    visit('/');
  });

  it('opens the profile window of a handle and prints the /follow hint into it', async () => {
    const asked = serveSearch({ accounts: [ALLY], statuses: [], hashtags: [] });
    visit('/#/authorize_interaction?uri=acct:ally@x.example');

    const { result } = mountRouter(useHashRoute, true);

    await waitFor(() => {
      expect(titles(result.current.state)).toStrictEqual(['status', '@ally@x.example']);
    });

    const win = `profile:${LAIN.key}:55`;

    expect(result.current.state.windows.activeId).toBe(win);
    expect(bufferFor(result.current.state, win).lines).toContainEqual(
      expect.objectContaining({ text: 'Type /follow to follow @ally@x.example' }),
    );
    expect(window.location.hash).toBe('');
    expect(asked.map((query) => Object.fromEntries(query))).toStrictEqual([
      { q: 'ally@x.example', resolve: 'true', limit: '1' },
    ]);
  });

  it('opens the thread window of a post URL', async () => {
    const asked = serveSearch({ accounts: [], statuses: [status('9')], hashtags: [] });
    visit('/#/authorize_interaction?uri=https%3A%2F%2Fx.example%2F%40ally%2F1');

    const { result } = mountRouter(useHashRoute, true);

    await waitFor(() => {
      expect(titles(result.current.state)).toStrictEqual(['status', 'thread/9']);
    });

    expect(result.current.state.windows.activeId).toBe(`thread:${LAIN.key}:9`);
    expect(asked[0]?.get('q')).toBe('https://x.example/@ally/1');
  });

  it('accepts the old template’s acct parameter', async () => {
    const asked = serveSearch({ accounts: [ALLY] });
    visit('/#/authorize_interaction?acct=ally@x.example');

    mountRouter(useHashRoute, true);

    await waitFor(() => {
      expect(asked).toHaveLength(1);
    });

    expect(asked[0]?.get('q')).toBe('ally@x.example');
  });

  it('prints that nothing was found and opens nothing', async () => {
    serveSearch({ accounts: [], statuses: [], hashtags: [] });
    visit('/#/authorize_interaction?uri=nobody@x.example');

    const { result } = mountRouter(useHashRoute, true);

    await waitFor(() => {
      expect(statusLines(result.current.state)).toStrictEqual(['Could not find nobody@x.example']);
    });

    expect(titles(result.current.state)).toStrictEqual(['status']);
  });

  it('treats a failed search as finding nothing', async () => {
    server.use(
      http.get(`${ORIGIN}/api/v2/search`, () =>
        HttpResponse.json({ error: 'nope' }, { status: 500 }),
      ),
    );
    visit('/#/authorize_interaction?uri=ally@x.example');

    const { result } = mountRouter(useHashRoute, true);

    await waitFor(() => {
      expect(statusLines(result.current.state)).toStrictEqual(['Could not find ally@x.example']);
    });

    expect(titles(result.current.state)).toStrictEqual(['status']);
  });

  it('prints the /connect hint with nobody signed in and keeps the route', async () => {
    const asked = serveSearch({ accounts: [ALLY] });
    visit('/#/authorize_interaction?uri=ally@x.example');

    const { result } = mountRouter(useHashRoute, true, []);

    expect(statusLines(result.current.state)).toStrictEqual([
      'Not connected. Type /connect to log in.',
    ]);
    expect(window.location.hash).toBe('#/authorize_interaction?uri=ally@x.example');

    act(() => {
      result.current.dispatch({ type: 'accounts', accounts: [LAIN], activeKey: LAIN.key });
    });

    await waitFor(() => {
      expect(titles(result.current.state)).toStrictEqual(['status', '@ally@x.example']);
    });

    expect(asked).toHaveLength(1);
  });
});
