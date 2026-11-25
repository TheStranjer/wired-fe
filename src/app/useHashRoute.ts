/**
 * Hash routing (decision 4): once startup has restored the accounts and
 * detected their instances, and on every `hashchange` after that, the route
 * the address bar spells (src/lib/route) opens its window for the active
 * account (src/features/route). With nobody signed in the hash is kept and
 * the `/connect` hint printed; the effect runs again the moment an account
 * appears and finds the hash still there. An opened route is taken out of the
 * address bar with the page's own replace, so a reload never opens it a second
 * time. A hash that is not a route is left alone. A route always opens `here`,
 * in the focused pane, whatever the placement settings say (WFE-238).
 */

import { useEffect } from 'react';

import { connectHint } from './connectHint';
import { buildConfig } from '../config/config';
import { openRoute } from '../features/route/openRoute';
import { parseRoute } from '../lib/route';
import { printAction } from '../state/appState';
import { activeAccount } from '../state/selectors';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { STATUS_WINDOW_ID } from '../windows/model';

/** Opens what the address bar's hash spells, once startup is {@link ready}. */
export function useHashRoute(ready: boolean): void {
  const dispatch = useAppDispatch();
  const account = activeAccount(useAppState());

  useEffect(() => {
    if (!ready) {
      return undefined;
    }
    const run = (): void => {
      const route = parseRoute(location.hash);
      if (route === null) {
        return;
      }
      if (account === null) {
        dispatch(printAction(STATUS_WINDOW_ID, 'info', connectHint(buildConfig.instances)));
        return;
      }
      history.replaceState(null, '', location.pathname + location.search);
      void openRoute(route, { accountKey: account.key, session: account, dispatch });
    };
    run();
    window.addEventListener('hashchange', run);
    return () => {
      window.removeEventListener('hashchange', run);
    };
  }, [ready, account, dispatch]);
}
