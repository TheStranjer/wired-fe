/**
 * Tests for opening a route with nobody to open it (decision 4, WFE-340):
 * which instance a signed-out visitor may read a route from, by instance mode,
 * and what that and the build's `publicView` make of a route. Opening it is
 * ./publicRoute.open.test and ./publicRoute.user.test.
 */
import { describe, expect, it } from 'vitest';

import { publicCandidate, publicOrigin, routeArea } from './publicRoute';
import type { InstancesConfig } from '../config/schema';
import type { Route } from '../lib/route';
import { ORIGIN } from '../test/hashRoute';

const OTHER = 'https://b.example';

const NOTICE: Route = { kind: 'notice', value: '5' };
const TAG: Route = { kind: 'tag', value: 'rust' };
const USER: Route = { kind: 'user', value: '55' };

const SAME: InstancesConfig = { mode: 'same-origin' };

describe(routeArea, () => {
  it('names the read of the routes a visitor may open, and none for the rest', () => {
    expect(routeArea(NOTICE)).toBe('posts');
    expect(routeArea(USER)).toBe('profiles');
    expect(routeArea(TAG)).toBe('tags');
    expect(routeArea({ kind: 'acct', value: 'lain' })).toBeNull();
    expect(routeArea({ kind: 'interact', value: 'x' })).toBeNull();
  });
});

describe(publicOrigin, () => {
  it('is the page’s own origin for same-origin', () => {
    expect(publicOrigin(NOTICE, SAME, ORIGIN)).toBe(ORIGIN);
    expect(publicOrigin({ ...NOTICE, origin: ORIGIN }, SAME, ORIGIN)).toBe(ORIGIN);
  });

  it('is instances.origin for fixed', () => {
    const fixed: InstancesConfig = { mode: 'fixed', origin: OTHER };

    expect(publicOrigin(TAG, fixed, ORIGIN)).toBe(OTHER);
    expect(publicOrigin({ ...TAG, origin: OTHER }, fixed, ORIGIN)).toBe(OTHER);
  });

  it('is the route’s own origin for list, only when listed', () => {
    const list: InstancesConfig = { mode: 'list', origins: [ORIGIN, OTHER] };

    expect(publicOrigin({ ...NOTICE, origin: OTHER }, list, ORIGIN)).toBe(OTHER);
    expect(publicOrigin({ ...NOTICE, origin: 'https://c.example' }, list, ORIGIN)).toBeNull();
  });

  it('is none for an unqualified route in a list build, and for any open build', () => {
    const list: InstancesConfig = { mode: 'list', origins: [ORIGIN] };

    expect(publicOrigin(NOTICE, list, ORIGIN)).toBeNull();
    expect(publicOrigin({ ...NOTICE, origin: ORIGIN }, { mode: 'open' }, ORIGIN)).toBeNull();
    expect(publicOrigin(NOTICE, { mode: 'open' }, ORIGIN)).toBeNull();
  });

  it('is none for a qualified route naming another instance than the build serves', () => {
    const fixed: InstancesConfig = { mode: 'fixed', origin: ORIGIN };

    expect(publicOrigin({ ...NOTICE, origin: OTHER }, fixed, ORIGIN)).toBeNull();
    expect(publicOrigin({ ...NOTICE, origin: OTHER }, SAME, ORIGIN)).toBeNull();
  });

  it('is none for a route a visitor never opens', () => {
    expect(publicOrigin({ kind: 'acct', value: 'lain' }, SAME, ORIGIN)).toBeNull();
  });
});

describe(publicCandidate, () => {
  it('is the instance, the setting and the read, the backend deciding when publicView is unset', () => {
    expect(publicCandidate(NOTICE, { instances: SAME }, ORIGIN)).toStrictEqual({
      origin: ORIGIN,
      setting: 'backend',
      area: 'posts',
    });
  });

  it('is forced on by publicView true, and none when publicView is false', () => {
    expect(publicCandidate(TAG, { instances: SAME, publicView: true }, ORIGIN)?.setting).toBe(
      'force',
    );
    expect(publicCandidate(TAG, { instances: SAME, publicView: false }, ORIGIN)).toBeNull();
  });

  it('is none where there is no instance or no read', () => {
    expect(publicCandidate(NOTICE, { instances: { mode: 'open' } }, ORIGIN)).toBeNull();
    expect(publicCandidate({ kind: 'acct', value: 'a' }, { instances: SAME }, ORIGIN)).toBeNull();
  });
});
