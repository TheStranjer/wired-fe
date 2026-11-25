/**
 * Whether the user asked the system for reduced motion, kept live: it follows
 * the `prefers-reduced-motion: reduce` media query as it changes. A browser
 * without `matchMedia` counts as no preference.
 */

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** Whether this environment can answer media queries. */
function canMatch(): boolean {
  return typeof window.matchMedia === 'function';
}

/** Call `notify` whenever the preference changes; returns the unsubscribe. */
function subscribe(notify: () => void): () => void {
  if (!canMatch()) {
    return () => undefined;
  }
  const query = window.matchMedia(QUERY);
  query.addEventListener('change', notify);
  return () => {
    query.removeEventListener('change', notify);
  };
}

/** The current answer to the media query. */
function snapshot(): boolean {
  return canMatch() && window.matchMedia(QUERY).matches;
}

/** True while the user prefers reduced motion. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot);
}
