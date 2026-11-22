/**
 * Startup turning a path route into a hash route (decision 4): a page loaded
 * at `/notice/<id>` has its address bar rewritten to `/#/notice/<id>` before
 * the session is restored, and a page at its own root is left alone.
 */
import { describe, expect, it, vi } from 'vitest';

import { runStartup } from './startup';
import { createAccountStore } from '../accounts/accountStore';
import { createStore } from '../storage/store';

/** Startup over empty stores and a page at {@link pathname}; the rewrites it asked for. */
async function rewritesAt(pathname: string): Promise<readonly string[]> {
  const replaceUrl = vi.fn<(path: string) => void>();
  await runStartup({
    dispatch: vi.fn(),
    stores: {
      apps: createStore('route-test-apps', null),
      login: createStore('route-test-login', null),
      accounts: createAccountStore(createStore('route-test-accounts', null)),
      settings: createStore('route-test-settings', null),
    },
    config: { appName: 'WIRED', instances: { mode: 'same-origin' } },
    now: () => new Date('2026-11-15T09:00:00.000Z'),
    location: { search: '', pathname, hash: '', replaceUrl },
  });
  return replaceUrl.mock.calls.map(([path]) => path);
}

describe(runStartup, () => {
  it('rewrites a path route into its hash route', async () => {
    await expect(rewritesAt('/notice/abc')).resolves.toStrictEqual(['/#/notice/abc']);
    await expect(rewritesAt('/lain')).resolves.toStrictEqual(['/#/@lain']);
  });

  it('leaves the page at its own path alone', async () => {
    await expect(rewritesAt('/')).resolves.toStrictEqual([]);
  });
});
