/**
 * Startup: what the shell does the moment it mounts (AGENTS.md "Windows, like
 * IRC buffers"). It restores the stored settings, opens with the decorative
 * banner and its text alternative (WFE-135), completes an OAuth
 * login the redirect may have left in the address bar (decision 8), restores
 * the persisted accounts into the app state, opens a home window and a
 * notifications window for each of them, and asks every instance an account
 * lives on what it turned out to be (decision 5) — all through injected
 * dependencies, so the whole flow runs in a test without React, storage or
 * the network. Everything it says goes into the status window, window 1,
 * which is where every session begins.
 */

import { BANNER } from './banner';
import { connectHint } from './connectHint';
import { routeFromPath } from './routeFromPath';
import { detectOrigins } from './startupDetect';
import type { AppStores } from './stores';
import type { StoredAccount } from '../accounts/accountStore';
import { completeLogin } from '../accounts/completeLogin';
import type { Detect } from '../capabilities/detect';
import type { WiredConfig } from '../config/schema';
import type { LineLevel } from '../state/buffer';
import { DEFAULT_SETTINGS, SettingsSchema } from '../state/settings';
import { openStartupWindows } from '../state/startupWindows';
import type { Dispatch } from '../state/StateContext';
import { STATUS_WINDOW_ID } from '../windows/model';

export type { Detect };

/** The pieces of the address bar startup reads and may rewrite. */
export type StartupLocation = {
  /** The current query string (real one: `window.location.search`). */
  readonly search: string;
  /** The current path (real one: `window.location.pathname`). */
  readonly pathname: string;
  /** The current hash route (real one: `window.location.hash`). */
  readonly hash: string;
  /** Rewrites the address bar without a reload (real one: `history.replaceState(null, '', path)`). */
  readonly replaceUrl: (path: string) => void;
};

/** Everything startup needs, all of it injectable so the flow is testable. */
export type StartupDeps = {
  /** Asks the application's one reducer for a transition. */
  readonly dispatch: Dispatch;
  /** The persisted stores; startup reads accounts and settings from them. */
  readonly stores: AppStores;
  /** The build-time configuration of this bundle (decision 3). */
  readonly config: WiredConfig;
  /** The current moment, for stamping every printed line. */
  readonly now: () => Date;
  /** Where the page is, for finishing an OAuth login left in the URL (decision 8). */
  readonly location: StartupLocation;
  /** How to read an instance, when the session cache has none; the real detection unless a test says otherwise. */
  readonly detect?: Detect;
};

/** One client message printed into the status window. */
function printStatus(deps: StartupDeps, text: string, level: LineLevel): void {
  deps.dispatch({ type: 'print', windowId: STATUS_WINDOW_ID, date: deps.now(), level, text });
}

/** How every session opens: the decorative banner, its text alternative
 * (WFE-135) and the tagline. */
function greet(deps: StartupDeps): void {
  for (const text of BANNER) {
    deps.dispatch({
      type: 'print',
      windowId: STATUS_WINDOW_ID,
      date: deps.now(),
      level: 'info',
      text,
      decorative: true,
    });
  }
  printStatus(deps, `WIRED // ${deps.config.appName}`, 'info');
  printStatus(deps, 'Present day. Present time.', 'info');
}

/** The stored settings, or the defaults, restored before anything prints. */
function loadSettings(deps: StartupDeps): void {
  const stored = deps.stores.settings.get('settings', SettingsSchema);
  deps.dispatch({ type: 'settings', settings: stored ?? DEFAULT_SETTINGS });
}

/** The origins the accounts live on, distinct, in the order they were added. */
function originsOf(accounts: readonly StoredAccount[]): readonly string[] {
  return [...new Set(accounts.map((account) => account.origin))];
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

/** The line that reports a login completed from the address bar (decision 8). */
function loggedInLine(account: StoredAccount): string {
  return `Logged in to ${account.origin} as @${account.handle}`;
}

/**
 * Complete an OAuth login the redirect may have left in the URL: hand the
 * query to {@link completeLogin} before anything is restored, print what came
 * of it (nothing if ignored), and rewrite the address bar without its query
 * so a reload never replays `code` and `state`. No callback: left alone.
 */
async function finishPendingLogin(deps: StartupDeps): Promise<void> {
  const { apps, login, accounts } = deps.stores;
  const outcome = await completeLogin(
    { apps, login, accounts },
    { search: deps.location.search, appName: deps.config.appName, now: deps.now().getTime() },
  );
  if (outcome.kind === 'none') {
    return;
  }
  if (outcome.kind === 'ok') {
    printStatus(deps, loggedInLine(outcome.account), 'info');
  } else if (outcome.kind === 'error') {
    printStatus(deps, outcome.message, 'error');
  }
  deps.location.replaceUrl(deps.location.pathname + deps.location.hash);
}

/**
 * Boot the session into the status window: load the stored settings, greet,
 * finish a login left in the URL, turn a path route into its hash route
 * (./routeFromPath), restore the stored accounts into the app state and open
 * each one's home and notifications window, then either hint at `/connect`
 * (no accounts, by instance mode) or detect each account's instance once
 * (concurrently, one report per origin) and announce every account, the
 * active one marked.
 */
export async function runStartup(deps: StartupDeps): Promise<void> {
  loadSettings(deps);
  greet(deps);
  await finishPendingLogin(deps);
  routeFromPath(deps.location, deps.config.basePath);
  const accounts = deps.stores.accounts.list();
  const activeKey = deps.stores.accounts.activeKey();
  deps.dispatch({ type: 'accounts', accounts, activeKey });
  for (const action of openStartupWindows(accounts, activeKey)) {
    deps.dispatch({ type: 'windows', action });
  }
  if (accounts.length === 0) {
    printStatus(deps, connectHint(deps.config.instances), 'info');
    return;
  }
  await detectOrigins(deps, originsOf(accounts));
  announceAccounts(deps, accounts, activeKey);
}
