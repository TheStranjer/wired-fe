/**
 * Desk persistence (decision 17): whenever the windows or the desktops change,
 * the desk is saved to its source, debounced so a drag or a burst of commands
 * writes once. Nothing is written until startup has restored the saved desk
 * (`ready`), or the session's starting state would clobber it. A change that
 * alters nothing that is saved (unread counts, say) writes nothing.
 */

import { useEffect, useRef } from 'react';

import type { DeskSource } from './deskSource';
import { type DeskState, toSnapshot } from '../state/deskSnapshot';

/** How long the desk must sit still before it is written. */
export const SAVE_DELAY_MS = 500;

/** Keeps {@link source} holding {@link desk}, {@link SAVE_DELAY_MS} after the last change, once {@link ready}. */
export function useDeskPersistence(desk: DeskState, source: DeskSource, ready: boolean): void {
  const { windows, layout } = desk;
  const writtenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) {
      return;
    }
    const timer = setTimeout(() => {
      const snapshot = toSnapshot({ windows, layout }, Date.now());
      const body = JSON.stringify({ ...snapshot, updatedAt: 0 });
      if (body !== writtenRef.current) {
        writtenRef.current = body;
        source.store.set(source.deviceClass, snapshot);
      }
    }, SAVE_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [windows, layout, source, ready]);
}
