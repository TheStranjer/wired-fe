/**
 * How the language names are written wherever the reader picks a language
 * (decision 19): always the language's own name first, so a reader who cannot
 * read the current UI language can still find theirs. Pure; the names are
 * data, never translated.
 */

import { SUPPORTED_LOCALES, type Locale } from './supportedLocales';

/** One entry of {@link SUPPORTED_LOCALES}. */
export type Language = (typeof SUPPORTED_LOCALES)[number];

/** The entry of the language {@link code}. */
export function languageFor(code: Locale): Language {
  return SUPPORTED_LOCALES.reduce<Language>(
    (found, one) => (one.code === code ? one : found),
    SUPPORTED_LOCALES[0],
  );
}

/** `code — native name — English name`, the line `/lang` lists a language as. */
export function languageLine(language: Language): string {
  return `${language.code} — ${language.native} — ${language.english}`;
}
