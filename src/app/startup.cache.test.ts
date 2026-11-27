/**
 * Startup and the session cache of instance detection (decision 5): the first
 * startup of a session asks the instance what it is and keeps the answer; a
 * second startup — a page reload — reads it back, asks nothing, and still
 * dispatches and announces the profile.
 */
import { describe, expect, it, vi } from 'vitest';

import { type Detect, runStartup } from './startup';
import { createAccountStore } from '../accounts/accountStore';
import { createSyncStore } from '../accounts/syncPrefs';
import { DEFAULT_POLL_LIMITS, NO_ANONYMOUS_READS } from '../capabilities/capabilities';
import type { InstanceProfile } from '../capabilities/detect';
import { ok } from '../lib/result';
import type { AppAction } from '../state/reducer';
import { createStore } from '../storage/store';
import { memoryBackend } from '../test/memoryBackend';

const ORIGIN = 'https://a.example';

const PROFILE: InstanceProfile = {
  origin: ORIGIN,
  title: 'A Lounge',
  capabilities: {
    backend: 'mastodon',
    maxCharacters: 500,
    maxMediaAttachments: 4,
    pollLimits: DEFAULT_POLL_LIMITS,
    features: new Set(['editing', 'quotePosting']),
    anonymousReads: NO_ANONYMOUS_READS,
  },
};

describe('startup session cache', () => {
  it('reads a reload from the cache without asking the instance again', async () => {
    const accounts = createAccountStore(createStore('cache-accounts', memoryBackend()));
    accounts.add({
      origin: ORIGIN,
      accountId: '1',
      handle: 'lain@a.example',
      token: 'token',
      refreshToken: null,
      expiresAt: null,
    });
    const profiles = createStore('cache-profiles', memoryBackend());
    const detect = vi.fn<Detect>().mockResolvedValue(ok(PROFILE));
    const reload = async (): Promise<readonly AppAction[]> => {
      const dispatch = vi.fn<(action: AppAction) => void>();
      const stores = {
        apps: createStore('cache-apps', null),
        login: createStore('cache-login', null),
        settings: createStore('cache-settings', null),
        sync: createSyncStore(createStore('cache-sync', null)),
        accounts,
        profiles,
      };
      await runStartup({
        dispatch,
        stores,
        detect,
        config: { appName: 'WIRED', instances: { mode: 'same-origin' } },
        now: () => new Date('2026-11-15T09:00:00.000Z'),
        location: { search: '', pathname: '/', hash: '', replaceUrl: () => undefined },
      });
      return dispatch.mock.calls.map(([action]) => action);
    };

    await reload();
    const second = await reload();

    expect(detect).toHaveBeenCalledTimes(1);
    expect(second).toContainEqual({ type: 'profile', profile: PROFILE });
  });
});
