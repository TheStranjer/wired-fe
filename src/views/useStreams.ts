/**
 * Live updates for every signed-in account (AGENTS.md "Windows, like IRC
 * buffers"): one streaming connection per account in the app state, opened
 * when the account appears and closed when it goes. Each connection joins the
 * streams its open windows need (./streamTopics), and every event it delivers
 * goes through `streamActions` against the newest state and is dispatched.
 * What the connection is doing is printed in the status window: once when it
 * is live, once when it fails — which starts the polling fallback
 * (./pollFallback) — and once when it is restored, which stops it. Unmounting
 * closes every socket and stops every poll. The per-account part is
 * ./streamEntry.
 */

import { useEffect, useState } from 'react';

import { intervalScheduler } from './pollFallback';
import { type StreamDeps, type StreamEnv, StreamEntry } from './streamEntry';
import { syncSubscriptions, wantedStreams } from './streamTopics';
import type { StoredAccount } from '../accounts/accountStore';
import { connectStream } from '../api/streamClient';
import { useRefreshDeps } from '../state/RefreshContext';
import { useAppState } from '../state/StateContext';
import type { WindowState } from '../windows/model';

/** The real client and the real clock. */
const REAL_DEPS: StreamDeps = { connect: connectStream, schedule: intervalScheduler };

/** The slice of the app state the connections follow. */
type Followed = {
  readonly accounts: readonly StoredAccount[];
  readonly windows: readonly WindowState[];
};

/** Brings the connections to the accounts in {@link followed}, each joined to what its windows need. */
function syncStreams(entries: Map<string, StreamEntry>, followed: Followed, env: StreamEnv): void {
  const keys = new Set(followed.accounts.map((account) => account.key));
  for (const [key, entry] of entries) {
    if (!keys.has(key)) {
      entry.close();
      entries.delete(key);
    }
  }
  for (const account of followed.accounts) {
    const entry = entries.get(account.key) ?? new StreamEntry(env, account);
    entries.set(account.key, entry);
    syncSubscriptions(entry, wantedStreams(followed.windows, account.key));
  }
}

/**
 * Keeps one streaming connection per account alive, joined to the streams the
 * open windows need, and routes what arrives into them. {@link deps} lets a
 * test supply a fake client and clock.
 */
export function useStreams(deps: StreamDeps = REAL_DEPS): void {
  const state = useAppState();
  const { accounts } = state;
  const { windows } = state.windows;
  const refresh = useRefreshDeps();
  const [entries] = useState(() => new Map<string, StreamEntry>());
  useEffect(
    () => () => {
      for (const entry of entries.values()) {
        entry.close();
      }
      entries.clear();
    },
    [entries],
  );
  useEffect(() => {
    syncStreams(entries, { accounts, windows }, { deps, refresh });
  }, [entries, accounts, windows, deps, refresh]);
}
