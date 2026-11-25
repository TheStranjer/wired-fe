/**
 * The vocabulary of `/display` (decision 15): the keys a window can override,
 * the words each takes, and the candidates Tab offers after `/display `. The
 * command and its completion provider read the same lists, so what completes
 * is exactly what the command accepts.
 */

import { BOOLEAN_MEANINGS } from './booleanWords';
import type { Provider } from './complete';
import { compareWords, wordsOf } from '../lib/words';
import { DENSITIES } from '../state/settings';

/** The display values a window can override, in the order they print. */
export const DISPLAY_KEYS = ['density', 'avatars', 'images'] as const;

/** One of {@link DISPLAY_KEYS}. */
export type DisplayKey = (typeof DISPLAY_KEYS)[number];

/** The word that clears overrides. */
export const RESET_WORD = 'reset';

/** The command line this provider completes arguments of. */
const COMMAND_PREFIX = '/display ';

/** Whether {@link word} names a display key. */
export function isDisplayKey(word: string): word is DisplayKey {
  const keys: readonly string[] = DISPLAY_KEYS;
  return keys.includes(word);
}

/** Whether {@link word} is one of {@link DENSITIES}. */
export function isDensity(word: string): word is (typeof DENSITIES)[number] {
  const densities: readonly string[] = DENSITIES;
  return densities.includes(word);
}

/** The words {@link key} takes; every switch takes the words of {@link BOOLEAN_MEANINGS}. */
export function valuesOf(key: DisplayKey): readonly string[] {
  return key === 'density' ? DENSITIES : [...BOOLEAN_MEANINGS.keys()];
}

/** What may follow the arguments {@link given} so far: keys and `reset`, then the words of a key. */
function nextWords(given: readonly string[]): readonly string[] {
  const [first, second] = given;
  if (first === undefined) {
    return [...DISPLAY_KEYS, RESET_WORD];
  }
  if (second !== undefined) {
    return [];
  }
  if (first === RESET_WORD) {
    return DISPLAY_KEYS;
  }
  return isDisplayKey(first) ? valuesOf(first) : [];
}

/**
 * The provider for `/display` arguments: after `/display `, a word completes
 * to the keys and `reset`; after a key, to that key's values; after `reset`,
 * to the keys. The line before the word decides which.
 */
export function displayProvider(): Provider {
  return {
    accepts: (_word, isFirstWord, line) =>
      !isFirstWord && (line ?? '').trimStart().toLowerCase().startsWith(COMMAND_PREFIX),
    candidates: (word, before) => {
      const given = wordsOf(before ?? '').slice(1);
      const prefix = word.toLowerCase();
      return nextWords(given)
        .filter((candidate) => candidate.startsWith(prefix))
        .toSorted(compareWords);
    },
  };
}
