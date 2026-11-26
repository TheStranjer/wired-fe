/**
 * Which supported language to show (decision 19): the first of the reader's
 * setting, the instance's default and the browser's languages, in that order,
 * that names a supported one, else English. A tag matches by its language
 * subtag (`de-AT` is `de`), and every Chinese tag (`zh-TW`, `zh-Hant`) is
 * `zh-Hans`, the one Chinese catalog there is. Pure.
 */

import { SUPPORTED_LOCALES, type Locale } from './supportedLocales';

/** The language subtag of a BCP 47 tag, lowercase: `de` of `de-AT`, `zh` of `zh-Hans`. */
function languageOf(tag: string): string {
  return tag.replace(/-.*$/u, '').toLowerCase();
}

/** Each supported language subtag and the locale that answers to it. */
const BY_LANGUAGE: ReadonlyMap<string, Locale> = new Map(
  SUPPORTED_LOCALES.map((locale) => [languageOf(locale.code), locale.code]),
);

/** The sources of the choice, each optional. */
type Sources = {
  readonly user?: string | undefined;
  readonly instance?: string | undefined;
  readonly browser?: readonly string[] | undefined;
};

/** The supported locale a BCP 47 tag names by its language subtag; undefined for none. */
function matchTag(tag: string | undefined): Locale | undefined {
  return BY_LANGUAGE.get(languageOf(tag ?? ''));
}

/** The locale to show for {@link sources}; `en` when none of them names a supported one. */
export function resolveLocale(sources: Sources): Locale {
  const tags = [sources.user, sources.instance, ...(sources.browser ?? [])];
  return tags.map(matchTag).find((locale) => locale !== undefined) ?? 'en';
}
