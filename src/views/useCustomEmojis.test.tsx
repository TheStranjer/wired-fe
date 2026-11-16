/**
 * Tests for the custom emoji hook over the shared MSW server: the account's
 * instance is asked once and the answer is cached for every later mount on
 * that origin — a second account there pays nothing, as does a remount — two
 * hooks on an unanswered origin share the one request in flight, a refused
 * answer is simply the empty list and is not retried, and a null account key
 * asks nothing at all. Each test lives on its own origin: the cache is
 * module-level and outlives one test.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { useCustomEmojis } from './useCustomEmojis';
import type { StoredAccount } from '../accounts/accountStore';
import { initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import { server } from '../test/server';

/** One signed-in account on {@link origin}. */
function account(origin: string, accountId: string): StoredAccount {
  const nickname = `user-${accountId}`;
  return {
    key: `${origin}#${accountId}`,
    origin,
    accountId,
    handle: `${nickname}@${new URL(origin).host}`,
    token: 'not-a-real-token',
  };
}

/** The hook's answer as text: the shortcodes it lists, or `none` while empty. */
function Emojis(props: { readonly accountKey: string | null }): JSX.Element {
  const emojis = useCustomEmojis(props.accountKey);
  const words = emojis.map((emoji) => emoji.shortcode).join(' ');
  return <p>{words === '' ? 'none' : words}</p>;
}

/** A session holding {@link accounts} with {@link accountKey} active. */
function host(accountKey: string | null, accounts: readonly StoredAccount[]): JSX.Element {
  const state = appReducer(initialAppState(), {
    type: 'accounts',
    accounts,
    activeKey: accountKey,
  });
  return (
    <AppStateProvider initial={state}>
      <Emojis accountKey={accountKey} />
    </AppStateProvider>
  );
}

/** Serve {@link origin}'s emoji list with one shortcode; report the calls. */
function serveEmojis(origin: string, shortcode: string): () => number {
  let calls = 0;
  server.use(
    http.get(`${origin}/api/v1/custom_emojis`, () => {
      calls += 1;
      return HttpResponse.json([{ shortcode, url: `${origin}/e/${shortcode}.png` }]);
    }),
  );
  return () => calls;
}

describe(useCustomEmojis, () => {
  it('fetches the instance once and caches the list per origin', async () => {
    const origin = 'https://wired.example';
    const calls = serveEmojis(origin, 'lain');
    const lain = account(origin, '1');
    const sisy = account(origin, '2');

    render(host(lain.key, [lain]));

    await screen.findByText('lain');

    expect(calls()).toBe(1);

    render(host(sisy.key, [sisy, lain]));

    expect(screen.getAllByText('lain')).toHaveLength(2);
    expect(calls()).toBe(1);
  });

  it('shares the one request in flight between two hooks on an origin', async () => {
    const origin = 'https://shared.example';
    const calls = serveEmojis(origin, 'duo');
    const first = account(origin, '1');
    const second = account(origin, '2');

    render(host(first.key, [first]));

    render(host(second.key, [second]));

    await waitFor(() => {
      expect(screen.getAllByText('duo')).toHaveLength(2);
    });

    expect(calls()).toBe(1);
  });

  it('treats a refused answer as no emoji and does not retry the origin', async () => {
    const origin = 'https://broken.example';
    let calls = 0;
    server.use(
      http.get(`${origin}/api/v1/custom_emojis`, () => {
        calls += 1;
        return HttpResponse.json({ error: 'gone' }, { status: 500 });
      }),
    );
    const one = account(origin, '1');
    const two = account(origin, '2');

    render(host(one.key, [one]));

    expect(screen.getByText('none')).toBeInTheDocument();

    await waitFor(() => {
      expect(calls).toBe(1);
    });

    render(host(two.key, [two]));

    expect(screen.getAllByText('none')).toHaveLength(2);

    await waitFor(() => {
      expect(calls).toBe(1);
    });
  });

  it('asks nothing without an account', () => {
    const calls = serveEmojis('https://quiet.example', 'q');

    render(host(null, []));

    expect(screen.getByText('none')).toBeInTheDocument();
    expect(calls()).toBe(0);
  });
});
