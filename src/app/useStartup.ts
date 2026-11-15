/**
 * Boots the session exactly once per page load: {@link useStartup} builds the
 * startup dependencies from the live dispatch, the shared stores, the build
 * configuration, the address bar and a fresh clock, and runs them on mount
 * through {@link bootOnce}. The once-guard is a ref, not state: a dev-mode
 * effect run that fires twice around the same component instance (StrictMode)
 * must still boot the session exactly one time.
 */

import { useEffect, useRef } from 'react';

import { type StartupDeps, type StartupLocation, runStartup } from './startup';
import { appStores } from './stores';
import { buildConfig } from '../config/config';
import { useAppDispatch } from '../state/StateContext';

/** The live address bar: what startup reads of it and how it rewrites it. */
function appLocation(): StartupLocation {
  return {
    search: window.location.search,
    pathname: window.location.pathname,
    hash: window.location.hash,
    replaceUrl: (path: string) => {
      history.replaceState(null, '', path);
    },
  };
}

/**
 * Starts the session once: the first call sees {@link started} false, raises
 * it through {@link markStarted} and runs {@link boot}; every later call sees
 * it raised and does nothing. {@link useStartup} keeps the flag in a ref, so
 * the guard survives whatever a dev-mode double effect run does to the tree.
 */
export function bootOnce(started: boolean, markStarted: () => void, boot: () => void): void {
  if (started) {
    return;
  }
  markStarted();
  boot();
}

/** Runs {@link runStartup} once, on this component's first mount. */
export function useStartup(): void {
  const dispatch = useAppDispatch();
  const startedRef = useRef(false);

  useEffect(() => {
    const deps: StartupDeps = {
      dispatch,
      stores: appStores(),
      config: buildConfig,
      now: () => new Date(),
      location: appLocation(),
    };
    bootOnce(
      startedRef.current,
      () => {
        startedRef.current = true;
      },
      () => {
        void runStartup(deps);
      },
    );
  }, [dispatch]);
}
