/**
 * Startup: what the shell does the moment it mounts (AGENTS.md "Windows, like
 * IRC buffers"). It greets, restores the persisted accounts into the app
 * state, and asks every instance an account lives on what it turned out to be
 * (decision 5) — all through injected dependencies, so the whole flow runs in
 * a test without React, storage or the network. Everything it says goes into
 * the status window, window 1, which is where every session begins.
 */

import type { AppStores } from './stores';
import type { StoredAccount } from '../accounts/accountStore';
import {
  type ApiError,
  type InstanceProfile,
  detectInstance,
  describeApiError,
} from '../capabilities/detect';
import type { InstancesConfig, WiredConfig } from '../config/schema';
import type { Result } from '../lib/result';
import type { LineLevel } from '../state/buffer';
import type { Dispatch } from '../state/StateContext';
import { STATUS_WINDOW_ID } from '../windows/model';

/** The read of what one instance turned out to be; {@link detectInstance} by default. */
export type Detect = (origin: string) => Promise<Result<InstanceProfile, ApiError>>;

/** Everything startup needs, all of it injectable so the flow is testable. */
export type StartupDeps = {
  /** Asks the application's one reducer for a transition. */
  readonly dispatch: Dispatch;
  /** The persisted stores; startup reads only the accounts one. */
  readonly stores: AppStores;
  /** The build-time configuration of this bundle (decision 3). */
  readonly config: WiredConfig;
  /** The current moment, for stamping every printed line. */
  readonly now: () => Date;
  /** How to read an instance; {@link detectInstance} unless a test says otherwise. */
  readonly detect?: Detect;
};

/** One client message printed into the status window. */
function printStatus(deps: StartupDeps, text: string, level: LineLevel): void {
  deps.dispatch({ type: 'print', windowId: STATUS_WINDOW_ID, date: deps.now(), level, text });
}

/** The two lines every session opens with. */
function greet(deps: StartupDeps): void {
  printStatus(deps, `WIRED // ${deps.config.appName}`, 'info');
  printStatus(deps, 'Present day. Present time.', 'info');
}

/** What a build with no accounts says about `/connect`, by instance mode (decision 3). */
function notConnected(instances: InstancesConfig): string {
  switch (instances.mode) {
    case 'same-origin':
    case 'fixed':
      return 'Not connected. Type /connect to log in.';
    case 'list':
      return `Not connected. Type /connect <instance>. Available: ${instances.origins.join(', ')}`;
    case 'open':
      return 'Not connected. Type /connect <instance>, e.g. /connect wired.example';
  }
}

/** The origins the accounts live on, distinct, in the order they were added. */
function originsOf(accounts: readonly StoredAccount[]): readonly string[] {
  return [...new Set(accounts.map((account) => account.origin))];
}

/** The line naming what the instance at {@link profile}'s origin turned out to be. */
function connectedLine(profile: InstanceProfile): string {
  return `Connected to ${profile.title} (${profile.capabilities.backend}) at ${profile.origin}`;
}

/** Reports one detection: dispatches the profile and prints, or prints why not. */
function reportDetection(
  deps: StartupDeps,
  origin: string,
  outcome: Result<InstanceProfile, ApiError>,
): void {
  if (outcome.ok) {
    deps.dispatch({ type: 'profile', profile: outcome.value });
    printStatus(deps, connectedLine(outcome.value), 'info');
    return;
  }
  printStatus(deps, `Could not reach ${origin}: ${describeApiError(outcome.error)}`, 'error');
}

/** Detects every origin concurrently (decision 5) and reports them in order. */
async function detectOrigins(deps: StartupDeps, origins: readonly string[]): Promise<void> {
  const detect = deps.detect ?? detectInstance;
  const outcomes = await Promise.all(
    origins.map(async (origin) => ({ origin, outcome: await detect(origin) })),
  );
  for (const { origin, outcome } of outcomes) {
    reportDetection(deps, origin, outcome);
  }
}

/** One line per account, the active one marked. */
function announceAccounts(
  deps: StartupDeps,
  accounts: readonly StoredAccount[],
  activeKey: string | null,
): void {
  for (const account of accounts) {
    const mark = account.key === activeKey ? ' (active)' : '';
    printStatus(deps, `Logged in as @${account.handle}${mark}`, 'info');
  }
}

/**
 * Boot the session into the status window: greet, then restore the stored
 * accounts into the app state and either hint at `/connect` (no accounts, by
 * instance mode) or detect each account's instance once — concurrently, one
 * report per origin — and announce every account, the active one marked.
 */
export async function runStartup(deps: StartupDeps): Promise<void> {
  greet(deps);
  const accounts = deps.stores.accounts.list();
  const activeKey = deps.stores.accounts.activeKey();
  deps.dispatch({ type: 'accounts', accounts, activeKey });
  if (accounts.length === 0) {
    printStatus(deps, notConnected(deps.config.instances), 'info');
    return;
  }
  await detectOrigins(deps, originsOf(accounts));
  announceAccounts(deps, accounts, activeKey);
}
