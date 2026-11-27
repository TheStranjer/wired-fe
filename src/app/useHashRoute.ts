/**
 * Hash routing (decision 4): once startup has restored the accounts and
 * detected their instances, and on every `hashchange` after that, the route
 * the address bar spells (src/lib/route) opens its window for the active
 * account (src/features/route). A route qualified with an instance
 * (`#/<host>/notice/<id>`) opens for the active account when it is on that
 * origin, else for the first signed-in account on it. With no account to open
 * it (nobody signed in, or none on the named instance) the hash is kept and
 * the `/connect` hint, or a line naming the host, printed; the effect runs
 * again the moment an account appears and finds the hash still there. An opened route is taken out of the
 * address bar with the page's own replace, so a reload never opens it a second
 * time. A hash that is not a route is left alone. A route always opens `here`,
 * in the focused pane, whatever the placement settings say (WFE-238).
 */

import { useEffect } from 'react';

import { routeHint } from './routeHint';
import { openRoute } from '../features/route/openRoute';
import { routeAccount } from '../features/route/routeAccount';
import { parseRoute } from '../lib/route';
import { printAction } from '../state/appState';
import { activeAccount } from '../state/selectors';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { STATUS_WINDOW_ID } from '../windows/model';

/** Opens what the address bar's hash spells, once startup is {@link ready}. */
export function useHashRoute(ready: boolean): void {
  const dispatch = useAppDispatch();
  const state = useAppState();
  const account = activeAccount(state);
  const { accounts } = state;

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
        dispatch(printAction(STATUS_WINDOW_ID, 'info', routeHint(route)));
        return;
      }
      history.replaceState(null, '', location.pathname + location.search);
      void openRoute(route, { accountKey: opener.key, session: opener, dispatch });
    };
    run();
    window.addEventListener('hashchange', run);
    return () => {
      window.removeEventListener('hashchange', run);
    };
  }, [ready, account, accounts, dispatch]);
}
