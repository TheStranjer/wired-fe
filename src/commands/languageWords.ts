/**
 * The vocabulary of `/lang` (decision 19): the words Tab offers after
 * `/lang ` or `/language `, one per supported language (completing to its
 * code) and `auto`, each matched by its code, its native name or its English
 * name. The suggestion list shows the native name as the label and the
 * English name and code as the description. The command and the provider read
 * the same lists, so what completes is exactly what the command accepts.
 */

import type { Described, Provider } from './complete';
import type { Language } from '../i18n/languageLabels';
import { SUPPORTED_LOCALES } from '../i18n/supportedLocales';
import { t } from '../i18n/translate';
import { compareWords } from '../lib/words';

/** The word that clears the setting. */
export const AUTO_WORD = 'auto';

/** A line that is the language command and its first, unfinished argument. */
const FIRST_ARGUMENT = /^\s*\/(?:lang|language)\s+\S*$/iu;

/** Every word the argument completes to: each language's code, then `auto`. */
const WORDS: readonly string[] = [...SUPPORTED_LOCALES.map((one) => one.code), AUTO_WORD];

/** Each supported language by its code. */
const LANGUAGES: ReadonlyMap<string, Language> = new Map(
  SUPPORTED_LOCALES.map((one) => [one.code, one]),
);

/** The texts of {@link word} that a typed prefix may match: for a language its code and both names. */
function namesOf(word: string): readonly string[] {
  const language = LANGUAGES.get(word);
  const names = language === undefined ? [word] : [word, language.native, language.english];
  return names.map((name) => name.toLowerCase());
}

/** The row the suggestion list shows for {@link word}: a language, or `auto`. */
function rowOf(word: string): Described {
  const language = LANGUAGES.get(word);
  if (language === undefined) {
    return { word, label: word, description: t('commands.defs.lang.auto_hint') };
  }
  return {
    word,
    label: language.native,
    description: `${language.english} (${language.code})`,
  };
}

/**
 * The provider for the argument of `/lang` and `/language`: the first word
 * after the command completes to the code of every language whose code or
 * names start with it, and to `auto`; a bare space after the command offers
 * them all.
 */
export function languageProvider(): Provider {
  return {
    accepts: (_word, isFirstWord, line) => !isFirstWord && FIRST_ARGUMENT.test(line ?? ''),
    candidates: (word) => {
      const prefix = word.toLowerCase();
      return WORDS.filter((one) => namesOf(one).some((name) => name.startsWith(prefix))).toSorted(
        compareWords,
      );
    },
    describe: rowOf,
    bare: true,
  };
}
