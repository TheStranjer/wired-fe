/**
 * What a reader types to name a language (decision 19, `/lang`): its code
 * (`de`, any case; a region is dropped, `de-AT` is `de`; every Chinese tag is
 * `zh-Hans`), its name in its own language (`Deutsch`, `日本語`) or its name in
 * English (`German`, `Chinese`), the names in any case. Pure.
 */

import { matchTag } from './resolveLocale';
import { SUPPORTED_LOCALES, type Locale } from './supportedLocales';

/** A BCP 47 tag: a language subtag and any subtags after it. */
const TAG = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/iu;

/** The supported language {@link input} names by its code, or null. */
function byCode(input: string): Locale | null {
  return TAG.test(input) ? (matchTag(input) ?? null) : null;
}

/** The supported language {@link input} names by its native or English name, or null. */
function byName(input: string): Locale | null {
  const found = SUPPORTED_LOCALES.find(
    (one) => one.native.toLowerCase() === input || one.english.toLowerCase() === input,
  );
  return found?.code ?? null;
}

/** The supported language {@link input} names by code, native name or English name; null for none. */
export function parseLanguage(input: string): Locale | null {
  const text = input.trim().toLowerCase();
  return byCode(text) ?? byName(text);
}

/** {@link value} when it is the code of a supported language, else null (a stored code this build does not know). */
export function knownLanguage(value: string | null): Locale | null {
  const found = SUPPORTED_LOCALES.find((one) => one.code === value);
  return found?.code ?? null;
}
