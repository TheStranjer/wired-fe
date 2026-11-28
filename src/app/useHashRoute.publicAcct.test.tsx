/**
 * Tests for the hash router opening an account by name with nobody signed in
 * (decision 4, WFE-342): a local nickname (`#/@wanda`, where wired-be's
 * `/users/<nickname>` lands) opens her profile read-only under the signed-out
 * key of the instance and the hash leaves the address bar; a refused lookup
 * prints the hint and keeps the hash; a remote handle gets the hint at once.
 */
import { waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import type { PublicConfig } from './publicRoute';
import { useHashRoute } from './useHashRoute';
import { capabilitiesOn } from '../capabilities/testCapabilities';
import { anonKey } from '../state/anonAccount';
import type { AppAction } from '../state/reducer';
import { ALLY, mountRouter, statusLines, titles, visit } from '../test/hashRoute';
import { server } from '../test/server';

const HERE = window.location.origin;
const LOOKUP_URL = `${HERE}/api/v1/accounts/lookup`;
const SAME: PublicConfig = { instances: { mode: 'same-origin' } };
const HINT = 'Not connected. Type /connect to log in.';

/** The page's own instance as detected, showing every local read to visitors. */
const DETECTED: AppAction = {
  type: 'profile',
  profile: {
    origin: HERE,
    title: 'Wired',
    capabilities: {
      ...capabilitiesOn('wired', []),
      anonymousReads: {
        posts: { local: true, remote: false },
        profiles: { local: true, remote: false },
        tags: { local: true, remote: false },
      },
    },
  },
};

/** A hook mounting the router of a same-origin build. */
function useRouter(ready: boolean): void {
  useHashRoute(ready, SAME);
}

/** The router mounted with nobody signed in and the page's instance detected. */
function mount(): ReturnType<typeof mountRouter> {
  return mountRouter(useRouter, true, [DETECTED]);
}

describe('the hash router opening an account by name with nobody signed in', () => {
  afterEach(() => {
    visit('/');
  });

  it('opens a local nickname’s profile read-only and takes the hash out of the address bar', async () => {
    server.use(http.get(LOOKUP_URL, () => HttpResponse.json(ALLY)));
    visit('/#/@wanda');

    const { result } = mount();

    await waitFor(() => {
      expect(result.current.state.windows.activeId).toBe(`profile:${anonKey(HERE)}:55`);
    });

    expect(window.location.hash).toBe('');
  });

  it('prints the hint and keeps the hash when the lookup is refused', async () => {
    server.use(http.get(LOOKUP_URL, () => HttpResponse.json({ error: 'no' }, { status: 403 })));
    visit('/#/@wanda');

    const { result } = mount();

    await waitFor(() => {
      expect(statusLines(result.current.state)).toStrictEqual([HINT]);
    });

    expect(titles(result.current.state)).toStrictEqual(['status']);
    expect(window.location.hash).toBe('#/@wanda');
  });

  it('prints the hint at once and keeps the hash for a remote handle', () => {
    visit('/#/@bob@elsewhere.example');

    const { result } = mount();

    expect(statusLines(result.current.state)).toStrictEqual([HINT]);
    expect(window.location.hash).toBe('#/@bob@elsewhere.example');
  });
});
