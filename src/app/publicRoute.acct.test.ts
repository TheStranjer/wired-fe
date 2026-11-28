/**
 * Tests for opening an account by name with nobody to open it (decision 4,
 * WFE-342): a local handle (`#/@wanda`, where wired-be's `/users/<nickname>`
 * lands) is looked up with no `Authorization` header and opens as a signed-out
 * profile window; an instance that refuses her sends the visitor back to the
 * hint, with one warning where the build forced public view on against the
 * backend; a build with public view off never takes the route.
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

const WANDA: Route = { kind: 'acct', value: 'wanda' };
const LOOKUP_URL = `${ORIGIN}/api/v1/accounts/lookup`;
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

describe('openPublicRoute for an account by name', () => {
  it('looks a local handle up with no Authorization header and opens her signed-out profile', async () => {
    const seen: { readonly auth: string | null; readonly acct: string | null }[] = [];
    server.use(
      http.get(LOOKUP_URL, ({ request }) => {
        const acct = new URL(request.url).searchParams.get('acct');
        seen.push({ auth: request.headers.get('Authorization'), acct });
        return HttpResponse.json(ALLY);
      }),
    );
    const run = setup(SAME, true);

    await expect(openPublicRoute(WANDA, run.deps)).resolves.toBe(true);
    expect(seen).toStrictEqual([{ auth: null, acct: 'wanda' }]);
    expect(openedWindow(run.dispatch)).toStrictEqual({
      type: 'windows',
      action: {
        type: 'open',
        ref: { kind: 'profile', accountKey: anonKey(ORIGIN), target: '55' },
        title: '@ally@x.example',
      },
    });
  });

  it('opens a handle on the instance’s own host the same way', async () => {
    server.use(http.get(LOOKUP_URL, () => HttpResponse.json(ALLY)));
    const run = setup(SAME, true);

    await expect(
      openPublicRoute({ kind: 'acct', value: 'wanda@wired.example' }, run.deps),
    ).resolves.toBe(true);
    expect(openedWindow(run.dispatch)).toMatchObject({ type: 'windows' });
  });

  it('falls back to the hint when the lookup is refused, opening nothing', async () => {
    server.use(http.get(LOOKUP_URL, () => HttpResponse.json({ error: 'no' }, { status: 403 })));
    const run = setup(SAME, true);

    await expect(openPublicRoute(WANDA, run.deps)).resolves.toBe(false);
    expect(openedWindow(run.dispatch)).toBeUndefined();
  });

  it('warns once that publicView is forced on when the backend restricts the read', async () => {
    server.use(http.get(LOOKUP_URL, () => HttpResponse.json({ error: 'no' }, { status: 401 })));
    const run = setup({ ...SAME, publicView: true }, false);

    await expect(openPublicRoute(WANDA, run.deps)).resolves.toBe(false);
    expect(printed(run.dispatch).at(-1)).toBe(
      'publicView is forced on for wired.example, but the instance restricts this read for signed-out visitors.',
    );
  });

  it('is not taken where the build turns public view off', async () => {
    const lookups = vi.fn<() => Response>(() => HttpResponse.json(ALLY));
    server.use(http.get(LOOKUP_URL, lookups));
    const run = setup({ ...SAME, publicView: false }, true);

    await expect(openPublicRoute(WANDA, run.deps)).resolves.toBe(false);
    expect(lookups).not.toHaveBeenCalled();
  });

  it('is not taken for a remote handle', async () => {
    const run = setup(SAME, true);

    await expect(
      openPublicRoute({ kind: 'acct', value: 'bob@elsewhere.example' }, run.deps),
    ).resolves.toBe(false);
    expect(openedWindow(run.dispatch)).toBeUndefined();
  });
});
