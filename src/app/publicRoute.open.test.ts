/**
 * Tests for opening a post or a tag with nobody to open it (decision 4,
 * WFE-340), the decision wiring: `publicView` off, the backend allowing the
 * read, the backend restricting it, forced on against the backend, an
 * instance that cannot be read, and one already detected.
 */
import { describe, expect, it, vi } from 'vitest';

import { type PublicConfig, type PublicDeps, openPublicRoute } from './publicRoute';
import { depsOf, openedWindow, printed, profileOf, publishing } from './publicRouteHarness';
import type { Detect } from '../capabilities/detect';
import { err, ok } from '../lib/result';
import type { Route } from '../lib/route';
import { anonKey } from '../state/anonAccount';
import type { Dispatch } from '../state/StateContext';
import { fakeCommandContext } from '../test/commandContext';
import { ORIGIN } from '../test/hashRoute';

const NOTICE: Route = { kind: 'notice', value: '5' };
const TAG: Route = { kind: 'tag', value: 'rust' };

const SIGNED_OUT = anonKey(ORIGIN);

/** The deps over a build of {@link config} whose instance {@link detect} answers, and the dispatch that records. */
function setup(
  config: PublicConfig,
  detect: Detect,
  known = false,
): { readonly deps: PublicDeps; readonly dispatch: ReturnType<typeof vi.fn<Dispatch>> } {
  const dispatch = vi.fn<Dispatch>();
  const { stores } = fakeCommandContext();
  const profile = known ? profileOf(ORIGIN, publishing(true)) : undefined;
  return { deps: depsOf({ dispatch, config, detect, stores }, ORIGIN, profile), dispatch };
}

/** A detector answering what an instance publishing {@link value} for every read is. */
function detecting(value: boolean | null): ReturnType<typeof vi.fn<Detect>> {
  return vi.fn<Detect>().mockResolvedValue(ok(profileOf(ORIGIN, publishing(value))));
}

describe('openPublicRoute and the decision', () => {
  it('opens nothing and asks nothing when publicView is off', async () => {
    const detect = detecting(true);
    const run = setup({ instances: { mode: 'same-origin' }, publicView: false }, detect);

    await expect(openPublicRoute(NOTICE, run.deps)).resolves.toBe(false);
    expect(detect).not.toHaveBeenCalled();
    expect(run.dispatch).not.toHaveBeenCalled();
  });

  it('opens the signed-out window when the backend allows the read, and says what it detected', async () => {
    const run = setup({ instances: { mode: 'same-origin' } }, detecting(true));

    await expect(openPublicRoute(NOTICE, run.deps)).resolves.toBe(true);
    expect(openedWindow(run.dispatch)).toStrictEqual({
      type: 'windows',
      action: {
        type: 'open',
        ref: { kind: 'thread', target: '5', accountKey: SIGNED_OUT },
        title: 'thread/5',
      },
    });
    expect(printed(run.dispatch)).toStrictEqual([
      'Connected to Wired (wired) at https://wired.example',
    ]);
  });

  it('opens a tag as a signed-out hashtag window, an unpublished read counting as allowed', async () => {
    const run = setup({ instances: { mode: 'same-origin' } }, detecting(null));

    await expect(openPublicRoute(TAG, run.deps)).resolves.toBe(true);
    expect(openedWindow(run.dispatch)).toMatchObject({
      action: { ref: { kind: 'hashtag', target: 'rust', accountKey: SIGNED_OUT } },
    });
  });

  it('does not detect again what is already known', async () => {
    const detect = detecting(true);
    const run = setup({ instances: { mode: 'same-origin' } }, detect, true);

    await expect(openPublicRoute(NOTICE, run.deps)).resolves.toBe(true);
    expect(detect).not.toHaveBeenCalled();
    expect(printed(run.dispatch)).toStrictEqual([]);
  });

  it('opens nothing when the backend restricts the read', async () => {
    const run = setup({ instances: { mode: 'same-origin' } }, detecting(false));

    await expect(openPublicRoute(NOTICE, run.deps)).resolves.toBe(false);
    expect(openedWindow(run.dispatch)).toBeUndefined();
  });

  it('opens it when forced on against the backend; the refusal is for the fallback to meet', async () => {
    const run = setup({ instances: { mode: 'same-origin' }, publicView: true }, detecting(false));

    await expect(openPublicRoute(NOTICE, run.deps)).resolves.toBe(true);
    expect(openedWindow(run.dispatch)).toBeDefined();
  });

  it('opens nothing when the instance cannot be read, saying why', async () => {
    const detect = vi.fn<Detect>().mockResolvedValue(err({ kind: 'network', message: 'down' }));
    const run = setup({ instances: { mode: 'same-origin' } }, detect);

    await expect(openPublicRoute(NOTICE, run.deps)).resolves.toBe(false);
    expect(printed(run.dispatch)).toHaveLength(1);
  });

  it('opens nothing for a route with no instance to read from', async () => {
    const detect = detecting(true);
    const run = setup({ instances: { mode: 'open' } }, detect);

    await expect(openPublicRoute(NOTICE, run.deps)).resolves.toBe(false);
    expect(detect).not.toHaveBeenCalled();
  });
});
