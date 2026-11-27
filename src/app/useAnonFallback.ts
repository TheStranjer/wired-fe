/**
 * The fallback of a signed-out read (WFE-340, decision 4): when the instance
 * answers a window under an `anon:<origin>` key with a 401 or a 403, the
 * backend does not show that read to visitors after all. Every window of that
 * key is closed, the `/connect` hint is printed in the status window and the
 * link is put back in the address bar, so it opens after sign-in as it does
 * for a visitor with no way in at all. Where the build forced `publicView` on
 * and the backend published that it restricts this read, one warning says so,
 * so the admin knows the cause. The refusal comes as `anonRefused` from the
 * call site (src/state/refreshSession) and is answered with `anonHandled`.
 */

import { useEffect } from 'react';

import { connectHint } from './connectHint';
import { type PublicConfig, routeArea } from './publicRoute';
import { routeHint } from './routeHint';
import { decidePublicView } from '../capabilities/publicView';
import { buildConfig } from '../config/config';
import { publicViewSetting } from '../config/publicView';
import { warnConflict } from '../features/route/publicUser';
import { type Route, formatRoute } from '../lib/route';
import { anonOrigin } from '../state/anonAccount';
import { type AppState, printAction } from '../state/appState';
import { type Dispatch, useAppDispatch, useAppState } from '../state/StateContext';
import { STATUS_WINDOW_ID } from '../windows/model';
import type { WindowState } from '../windows/model';

/** The kind of route each signed-out window kind was opened from. */
const ROUTE_KINDS: Readonly<Partial<Record<string, 'notice' | 'tag' | 'user'>>> = {
  thread: 'notice',
  hashtag: 'tag',
  profile: 'user',
};

/**
 * The route {@link win} was opened from, written the way the build writes
 * permalinks (qualified in a `list` or `open` build, short otherwise); null for
 * a window no route opens.
 */
function routeOfWindow(win: WindowState, origin: string, config: PublicConfig): Route | null {
  const kind = ROUTE_KINDS[win.ref.kind];
  if (kind === undefined || win.ref.target === null) {
    return null;
  }
  const { mode } = config.instances;
  const qualified = mode === 'list' || mode === 'open';
  return { kind, value: win.ref.target, ...(qualified ? { origin } : {}) };
}

/** What answering a refusal reads and acts through. */
type Env = {
  readonly state: AppState;
  readonly config: PublicConfig;
  readonly go: Dispatch;
};

/** Whether the build forced public view on for the read of {@link route} where the instance says no. */
function isConflict(env: Env, origin: string, route: Route): boolean {
  const area = routeArea(route);
  const reads = env.state.profiles.get(origin)?.capabilities.anonymousReads;
  if (area === null || reads === undefined) {
    return false;
  }
  const setting = publicViewSetting(env.config, origin);
  return decidePublicView(setting, reads, { area, locality: 'local' }).conflict;
}

/** Closes the windows of the signed-out {@link key} of {@link origin}, says so and puts the link back. */
function closeRefused(key: string, origin: string, env: Env): void {
  const { state, config, go } = env;
  const shut = state.windows.windows.filter((win) => win.ref.accountKey === key);
  for (const win of shut) {
    go({ type: 'windows', action: { type: 'close', id: win.id } });
  }
  const route = shut.map((win) => routeOfWindow(win, origin, config)).findLast((r) => r !== null);
  const hint = route === undefined ? connectHint(config.instances) : routeHint(route);
  go(printAction(STATUS_WINDOW_ID, 'info', hint));
  if (route !== undefined) {
    if (isConflict(env, origin, route)) {
      warnConflict(go, origin);
    }
    history.replaceState(null, '', location.pathname + location.search + formatRoute(route));
  }
}

/** Answers the refusal of {@link key}, and marks it handled; a key that is not a signed-out one is only marked. */
function refuse(key: string, env: Env): void {
  const origin = anonOrigin(key);
  if (origin !== null) {
    closeRefused(key, origin, env);
  }
  env.go({ type: 'anonHandled', accountKey: key });
}

/** Answers every refusal of a signed-out read, as the module comment says. */
export function useAnonFallback(config: PublicConfig = buildConfig): void {
  const state = useAppState();
  const dispatch = useAppDispatch();
  useEffect(() => {
    for (const key of state.anonRefused) {
      refuse(key, { state, config, go: dispatch });
    }
  }, [state, config, dispatch]);
}
