/**
 * Settings persistence (decision 10, AGENTS.md "Security": src/storage is the
 * only module that touches `localStorage` — this hook just asks its store):
 * whenever the reader turns a knob and the reducer hands back a new settings
 * record, the whole record is written back under the `settings` key, so the
 * next session's startup reads it again. Mount itself never writes: the record
 * a session starts with is the one the reducer was seeded with, and writing it
 * before startup had read storage could only ever clobber what is stored.
 */

import { useEffect, useRef } from 'react';

import type { Settings } from '../state/settings';
import type { Store } from '../storage/store';

/** The key the whole settings record lives under in the settings store. */
const SETTINGS_KEY = 'settings';

/**
 * Keep {@link store} holding {@link settings}: every record that differs by
 * identity from the last one written (the one transition the reducer produced)
 * goes back to storage; a re-render with the same record writes nothing.
 */
export function useSettingsPersistence(settings: Settings, store: Store): void {
  const persistedRef = useRef<Settings>(settings);
  useEffect(() => {
    if (persistedRef.current === settings) {
      return;
    }
    persistedRef.current = settings;
    store.set(SETTINGS_KEY, settings);
  }, [settings, store]);
}
