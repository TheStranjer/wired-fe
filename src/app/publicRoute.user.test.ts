/**
 * Tests for opening an account's profile with nobody to open it (decision 4,
 * WFE-340): she is looked up with no `Authorization` header and opens as a
 * signed-out profile window; an instance that refuses her sends the visitor
 * back to the hint, with one warning where the build forced public view on
 * against the backend; a lookup that finds nobody says so and takes the route.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { type PublicConfig, type PublicDeps, openPublicRoute } from './publicRoute';
import { depsOf, openedWindow, printed, profileOf, publishing } from './publicRouteHarness';
import type { Detect } from '../capabilities/detect';
import { ok } from '../lib/result';
import type { Route } from '../lib/route';
import { anonKey } from '../state/anonAccount';
import type { Dispatch } from '../state/StateContext';
import { fakeCommandContext } from '../test/commandContext';
import { ALLY, ORIGIN } from '../test/hashRoute';
import { server } from '../test/server';

const USER: Route = { kind: 'user', value: '55' };
const ACCOUNT_URL = `${ORIGIN}/api/v1/accounts/55`;
const SAME: PublicConfig = { instances: { mode: 'same-origin' } };

/** The deps over {@link config} for an instance publishing {@link value} for every read, and the dispatch that records. */
function setup(
  config: PublicConfig,
  value: boolean,
): { readonly deps: PublicDeps; readonly dispatch: ReturnType<typeof vi.fn<Dispatch>> } {
  const dispatch = vi.fn<Dispatch>();
  const detect = vi.fn<Detect>().mockResolvedValue(ok(profileOf(ORIGIN, publishing(value))));
  const { stores } = fakeCommandContext();
  return { deps: depsOf({ dispatch, config, detect, stores }, ORIGIN), dispatch };
}

describe('openPublicRoute for an account', () => {
  it('looks her up with no Authorization header and opens her signed-out profile window', async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get(ACCOUNT_URL, ({ request }) => {
        seen.push(request.headers.get('Authorization'));
        return HttpResponse.json(ALLY);
      }),
    );
    const run = setup(SAME, true);

    await expect(openPublicRoute(USER, run.deps)).resolves.toBe(true);
    expect(seen).toStrictEqual([null]);
    expect(openedWindow(run.dispatch)).toStrictEqual({
      type: 'windows',
      action: {
        type: 'open',
        ref: { kind: 'profile', accountKey: anonKey(ORIGIN), target: '55' },
        title: '@ally@x.example',
      },
    });
  });

  it('falls back to the hint when the instance refuses her, with no warning when nothing was forced', async () => {
    server.use(http.get(ACCOUNT_URL, () => HttpResponse.json({ error: 'no' }, { status: 403 })));
    const run = setup(SAME, true);

    await expect(openPublicRoute(USER, run.deps)).resolves.toBe(false);
    expect(printed(run.dispatch)).toStrictEqual([
      'Connected to Wired (wired) at https://wired.example',
    ]);
  });

  it('warns once that publicView is forced on when the backend restricts the read', async () => {
    server.use(http.get(ACCOUNT_URL, () => HttpResponse.json({ error: 'no' }, { status: 401 })));
    const run = setup({ ...SAME, publicView: true }, false);

    await expect(openPublicRoute(USER, run.deps)).resolves.toBe(false);
    expect(printed(run.dispatch).at(-1)).toBe(
      'publicView is forced on for wired.example, but the instance restricts this read for signed-out visitors.',
    );
  });

  it('says why when she cannot be found, and takes the route', async () => {
    server.use(
      http.get(ACCOUNT_URL, () =>
        HttpResponse.json({ error: 'Record not found' }, { status: 404 }),
      ),
    );
    const run = setup(SAME, true);

    await expect(openPublicRoute(USER, run.deps)).resolves.toBe(true);
    expect(printed(run.dispatch).at(-1)).toContain('Record not found');
  });
});
