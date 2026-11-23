/**
 * Tests for the app's refresher: it reaches the application's account store,
 * hands out the cached OAuth app of an instance for the page's redirect URI
 * (registering one, named by the build's app name, when there is none), and
 * reads the real clock. The instance is served by MSW.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { appRefresher } from './appRefresher';
import { appStores } from './stores';
import { ok } from '../lib/result';
import { server } from '../test/server';

const ORIGIN = 'https://refresh.example';
const APP = { client_id: 'cid', client_secret: 'csecret' };

describe(appRefresher, () => {
  it('shares the application accounts store and the real clock', () => {
    const refresher = appRefresher();
    const before = Date.now();

    expect(refresher.accounts).toBe(appStores().accounts);
    expect(refresher.now()).toBeGreaterThanOrEqual(before);
  });

  it('registers the app for the page redirect once and then serves it from the cache', async () => {
    let registrations = 0;
    server.use(
      http.post(`${ORIGIN}/api/v1/apps`, async ({ request }) => {
        registrations += 1;
        const body: unknown = await request.json();

        expect(body).toMatchObject({
          redirect_uris: `${window.location.origin}${window.location.pathname}`,
        });

        return HttpResponse.json(APP);
      }),
    );
    const { getApp } = appRefresher();

    const first = await getApp(ORIGIN);
    const second = await getApp(ORIGIN);

    expect(first).toStrictEqual(ok(APP));
    expect(second).toStrictEqual(ok(APP));
    expect(registrations).toBe(1);
  });
});
