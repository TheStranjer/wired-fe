/**
 * Hash routing (decision 4): once startup has restored the accounts and
 * detected their instances, and on every `hashchange` after that, the route
 * the address bar spells (src/lib/route) opens its window for the active
 * account (src/features/route). A route qualified with an instance
 * (`#/<host>/notice/<id>`) opens for the active account when it is on that
 * origin, else for the first signed-in account on it. With no account to open
 * it (nobody signed in, or none on the named instance) a public link may still
 * open read-only for the visitor (./publicRoute, WFE-340): the build and the
 * instance decide, and the window is the signed-out one of that origin. When
 * nothing opens it, the hash is kept and the `/connect` hint, or a line naming
 * the host, printed; the effect runs again the moment an account appears and
 * finds the hash still there. An opened route is taken out of the address bar
 * with the page's own replace, so a reload never opens it a second time. A
 * hash that is not a route is left alone. A route always opens `here`, in the
 * focused pane, whatever the placement settings say (WFE-238). A signed-out
 * window the instance refuses is closed and its link put back (./useAnonFallback).
 */

import { useEffect, useRef } from 'react';

import {
  type PublicConfig,
  type PublicDeps,
  openPublicRoute,
  publicCandidate,
} from './publicRoute';
import { routeHint } from './routeHint';
import { appStores } from './stores';
import { useAnonFallback } from './useAnonFallback';
import { buildConfig } from '../config/config';
import { openRoute } from '../features/route/openRoute';
import { routeAccount } from '../features/route/routeAccount';
import { type Route, parseRoute } from '../lib/route';
import { printAction } from '../state/appState';
import { activeAccount } from '../state/selectors';
import { type Dispatch, useAppDispatch, useAppState } from '../state/StateContext';
import { STATUS_WINDOW_ID } from '../windows/model';

/** Takes the hash out of the address bar, which does not fire `hashchange`. */
function clearHash(): void {
  history.replaceState(null, '', location.pathname + location.search);
}

/** Opens {@link route} with no account: read-only when public view allows it, else the hint and the hash kept. */
function openWithoutAccount(route: Route, deps: PublicDeps): void {
  if (publicCandidate(route, deps.config, deps.here) === null) {
    deps.dispatch(printAction(STATUS_WINDOW_ID, 'info', routeHint(route)));
    return;
  }
  void openPublicRoute(route, deps).then((taken) => {
    if (taken) {
      clearHash();
    } else {
      deps.dispatch(printAction(STATUS_WINDOW_ID, 'info', routeHint(route)));
    }
  });
}

/** What the public route needs from the render that is running: the dispatch, the config, what is detected. */
function publicDeps(
  dispatch: Dispatch,
  config: PublicConfig,
  profiles: PublicDeps['profiles'],
): PublicDeps {
  return {
    dispatch,
    config,
    profiles,
    stores: appStores(),
    now: () => new Date(),
    here: location.origin,
  };
}

/** Opens what the address bar's hash spells, once startup is {@link ready}. */
export function useHashRoute(ready: boolean, config: PublicConfig = buildConfig): void {
  const dispatch = useAppDispatch();
  const state = useAppState();
  const account = activeAccount(state);
  const { accounts, profiles } = state;
  const profilesRef = useRef(profiles);
  useAnonFallback(config);

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);
  useEffect(() => {
    if (!ready) {
      return undefined;
    }
    const run = (): void => {
      const route = parseRoute(location.hash);
      if (route === null) {
        return;
      }
      const opener = routeAccount(route, account, accounts);
      if (opener === null) {
        openWithoutAccount(route, publicDeps(dispatch, config, profilesRef.current));
        return;
      }
      clearHash();
      void openRoute(route, { accountKey: opener.key, session: opener, dispatch });
    };
    run();
    window.addEventListener('hashchange', run);
    return () => {
      window.removeEventListener('hashchange', run);
    };
  }, [ready, account, accounts, dispatch, config]);
}
