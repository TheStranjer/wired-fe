/**
 * The message catalogs in memory (decision 19): English, imported statically
 * as the source, plus every other language once it has been loaded or
 * installed. A catalog keeps its own formatter cache, so replacing it drops
 * the formatters built from the old messages.
 */

import type { IntlMessageFormat } from 'intl-messageformat';

import { LOADERS } from './loaders';
import english from './locales/en.json';
import { flatten } from './messages';

/** The language of the source catalog, the fallback for every other. */
export const SOURCE_LOCALE = 'en';

/** One language's messages by dot path, with the formatters built from them (null: unusable). */
export type Catalog = {
  readonly messages: ReadonlyMap<string, string>;
  readonly formatters: Map<string, IntlMessageFormat | null>;
};

/** A catalog of the parsed JSON {@link messages}. */
function catalogOf(messages: unknown): Catalog {
  return { messages: flatten(messages), formatters: new Map() };
}

/** The catalogs held, by language; English is always there. */
const held = new Map<string, Catalog>([[SOURCE_LOCALE, catalogOf(english)]]);

/** The loaders of the catalog files by path, each resolving to the parsed JSON. */
type Loaders = Readonly<Record<string, () => Promise<unknown>>>;

/** Where catalogs come from: the files in `locales/`, unless a test replaced them. */
let loaders: Loaders = LOADERS;

/** The loads in flight, by language, so a catalog is fetched once. */
const pending = new Map<string, Promise<boolean>>();

/** The catalog of {@link locale}; undefined while it is not loaded. */
export function catalogFor(locale: string): Catalog | undefined {
  return held.get(locale);
}

/** Hold {@link messages}, a parsed JSON catalog, as the messages of {@link locale}. */
export function installCatalog(locale: string, messages: unknown): void {
  held.set(locale, catalogOf(messages));
}

/** Run {@link loader} and hold what it resolves to; false when it fails. */
async function read(locale: string, loader: () => Promise<unknown>): Promise<boolean> {
  try {
    installCatalog(locale, await loader());
    return true;
  } catch {
    return false;
  } finally {
    pending.delete(locale);
  }
}

/**
 * Load the catalog of {@link locale} once. Resolves true when it is held
 * afterwards; false when the language has no file yet or the file failed to
 * load (a failed load can be tried again).
 */
export async function loadCatalog(locale: string): Promise<boolean> {
  if (held.has(locale)) {
    return true;
  }
  const loader = loaders[`./locales/${locale}.json`];
  if (loader === undefined) {
    return false;
  }
  const started = pending.get(locale) ?? read(locale, loader);
  pending.set(locale, started);
  return await started;
}

/** Load catalogs from {@link next} instead of the files in `locales/` (tests only). */
export function replaceLoaders(next: Loaders): void {
  loaders = next;
}

/** Forget every catalog but English and go back to the real loaders (tests only). */
export function dropLoadedCatalogs(): void {
  for (const locale of [...held.keys()].filter((name) => name !== SOURCE_LOCALE)) {
    held.delete(locale);
  }
  pending.clear();
  loaders = LOADERS;
}
