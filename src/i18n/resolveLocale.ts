/**
 * Which supported language to show (decision 19): the first of the reader's
 * setting, the instance's default and the browser's languages, in that order,
 * that names a supported one, else English. A tag matches by its language
 * subtag (`de-AT` is `de`), and every Chinese tag (`zh-TW`, `zh-Hant`) is
 * `zh-Hans`, the one Chinese catalog there is. {@link resolveSource} also says
 * which of the sources decided (`/lang` tells the reader). Pure.
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
export function matchTag(tag: string | undefined): Locale | undefined {
  return BY_LANGUAGE.get(languageOf(tag ?? ''));
}

/** Which source decided the language: the reader's setting, the instance, the browser, or none of them. */
type LocaleSource = 'user' | 'instance' | 'browser' | 'fallback';

/** The language to show and the source that chose it. */
export type Resolved = { readonly locale: Locale; readonly source: LocaleSource };

/** One source and the tags it offers. */
type Offer = readonly [LocaleSource, readonly (string | undefined)[]];

/** The sources in the order they are asked, each with the tags it offers. */
function ranked(sources: Sources): readonly Offer[] {
  return [
    ['user', [sources.user]],
    ['instance', [sources.instance]],
    ['browser', sources.browser ?? []],
  ];
}

/** The locale to show for {@link sources} and which source chose it; `en` from `fallback` when none names a supported one. */
export function resolveSource(sources: Sources): Resolved {
  for (const [source, tags] of ranked(sources)) {
    const locale = tags.map(matchTag).find((found) => found !== undefined);
    if (locale !== undefined) {
      return { locale, source };
    }
  }
  return { locale: 'en', source: 'fallback' };
}

/** The locale to show for {@link sources}; `en` when none of them names a supported one. */
export function resolveLocale(sources: Sources): Locale {
  return resolveSource(sources).locale;
}
