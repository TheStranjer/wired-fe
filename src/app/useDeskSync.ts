/**
 * The shell's side of the desk sync (decision 17): once startup has restored
 * the accounts, detected their instances and put the desk in place, the
 * engine (./deskSyncEngine) pulls from the primary account's server; after
 * that every change to the windows, the desktops or the settings, the same
 * ones the local saves watch, is pushed after a quiet moment, and a request
 * from `/sync` (./syncRequests) pulls or syncs at once.
 */

import { useCallback, useEffect, useRef } from 'react';

import { deskSource } from './deskSource';
import { createEngine } from './deskSyncEngine';
import { appStores } from './stores';
import { onSyncRequest } from './syncRequests';
import { useAppDispatch, useAppState } from '../state/StateContext';

/** Keeps this device's desk and settings in step with the primary account's server, once {@link ready}. */
export function useDeskSync(ready: boolean): void {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const stateRef = useRef(state);
  const engineRef = useRef<ReturnType<typeof createEngine> | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  // Only effects call this, so the engine is made after the first render.
  const engine = useCallback(() => {
    engineRef.current ??= createEngine({
      getState: () => stateRef.current,
      dispatch,
      prefs: () => appStores().sync.read(),
      source: deskSource(),
      profiles: appStores().profiles,
      now: () => Date.now(),
    });
    return engineRef.current;
  }, [dispatch]);
  const { windows, layout, settings } = state;

  useEffect(() => {
    if (ready) {
      engine().start();
    }
  }, [ready, engine]);
  useEffect(() => {
    if (ready) {
      engine().changed();
    }
  }, [ready, engine, windows, layout, settings]);
  useEffect(
    () =>
      onSyncRequest((request) => {
        engine().request(request);
      }),
    [engine],
  );
  useEffect(
    () => () => {
      engine().stop();
    },
    [engine],
  );
}
