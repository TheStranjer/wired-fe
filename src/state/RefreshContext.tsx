/**
 * The React side of the token-refresh seam (./refreshSession): the app layer
 * puts a {@link Refresher} (its stores, OAuth app cache and clock) in front of
 * the tree, and {@link useRefreshDeps} hands a component the stable
 * {@link RefreshDeps} that reads the newest state at call time. Without a
 * provider the deps carry no refresher, so a refused token can only expire.
 */

import { createContext, use, useEffect, useMemo, useRef, type JSX, type ReactNode } from 'react';

import type { RefreshDeps, Refresher } from './refreshSession';
import { useAppDispatch, useAppState } from './StateContext';

/** The refresher the app layer supplied; null where none was. */
const RefresherContext = createContext<Refresher | null>(null);

/** Put {@link refresher} in front of {@link children}. */
export function RefresherProvider(props: {
  readonly refresher: Refresher;
  readonly children: ReactNode;
}): JSX.Element {
  return <RefresherContext value={props.refresher}>{props.children}</RefresherContext>;
}

/**
 * The deps for {@link withFreshToken}, stable across renders so they can sit
 * in an effect's dependency list; `getState` reads the newest state.
 */
export function useRefreshDeps(): RefreshDeps {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const refresher = use(RefresherContext);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  return useMemo(
    () => ({ refresher, dispatch, getState: () => stateRef.current }),
    [refresher, dispatch],
  );
}
