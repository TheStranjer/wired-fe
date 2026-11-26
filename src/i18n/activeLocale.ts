/**
 * The language in use (decision 19): one module-level value that plain code
 * reads through `t()` and React reads through a subscription. Switching waits
 * for the catalog, so the screen never shows a half-translated state. A
 * language with no file yet can be chosen (its messages are English until the
 * file lands); one whose file failed to load leaves English active.
 */

import { SOURCE_LOCALE, dropLoadedCatalogs, installCatalog, loadCatalog } from './catalogs';

/** The language in use. */
let active = SOURCE_LOCALE;

/** What to tell when the language changes. */
const listeners = new Set<() => void>();

/** The language most recently asked for, to drop an answer that arrives late. */
let requested = SOURCE_LOCALE;

/** The language in use. */
export function activeLocale(): string {
  return active;
}

/** Call {@link listener} whenever the language changes; returns the way to stop. */
export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Make {@link locale} the language in use and tell the listeners, if it changed. */
function activate(locale: string): void {
  if (locale !== active) {
    active = locale;
    listeners.forEach((listener) => {
      listener();
    });
  }
}

/**
 * Switch to {@link locale}: load its catalog, then make it active. English
 * stays (or becomes) active when the file fails to load. When two switches
 * overlap, the later one wins.
 */
export async function setLocale(locale: string): Promise<void> {
  requested = locale;
  const loaded = await loadCatalog(locale);
  if (requested === locale) {
    activate(loaded ? locale : SOURCE_LOCALE);
  }
}

/** Hold {@link messages} as the catalog of {@link locale} and switch to it at once (tests only). */
export function activateCatalog(locale: string, messages: unknown): void {
  installCatalog(locale, messages);
  requested = locale;
  activate(locale);
}

/** Back to English with no other catalog held (tests only). */
export function resetLocale(): void {
  dropLoadedCatalogs();
  requested = SOURCE_LOCALE;
  activate(SOURCE_LOCALE);
}
