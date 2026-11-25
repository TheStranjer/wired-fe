/**
 * The vocabulary of `/desktop` and `/mvd` (decision 18) and the candidates Tab
 * offers after them: `/desktop ` takes a form word, `/mvd <number> ` takes
 * `follow`. Numbers are not completed.
 */

import type { Provider } from './complete';
import { isDesktopNumber } from './desktopNumber';
import { compareWords, wordsOf } from '../lib/words';

/** The words `/desktop` takes in place of a number, in the order its usage names them. */
const DESKTOP_FORMS: readonly string[] = ['list', 'next', 'prev', 'new', 'close', 'prune'];

/** The word `/mvd` takes after the desktop number. */
const FOLLOW_WORD = 'follow';

/** The names `/desktop` answers to. */
const DESKTOP_NAMES: readonly string[] = ['/desktop', '/d'];

/** Every command line this provider completes arguments of. */
const COMPLETED_NAMES: readonly string[] = [...DESKTOP_NAMES, '/mvd'];

/** What may follow the command {@link name} once {@link given} arguments are typed. */
function nextWords(name: string, given: readonly string[]): readonly string[] {
  if (DESKTOP_NAMES.includes(name)) {
    return given.length === 0 ? DESKTOP_FORMS : [];
  }
  return name === '/mvd' && given.length === 1 && isDesktopNumber(given[0]) ? [FOLLOW_WORD] : [];
}

/** The lowercased command word the {@link line} starts with, or `''`. */
function commandOf(line: string | undefined): string {
  return (wordsOf(line ?? '')[0] ?? '').toLowerCase();
}

/**
 * The provider for `/desktop` (and `/d`) and `/mvd` arguments: after
 * `/desktop `, a word completes to the forms; after `/mvd <number> `, to
 * `follow`. The line before the word decides which.
 */
export function desktopProvider(): Provider {
  return {
    accepts: (_word, isFirstWord, line) =>
      !isFirstWord && COMPLETED_NAMES.includes(commandOf(line)),
    candidates: (word, before) => {
      const [name, ...given] = wordsOf(before ?? '');
      const prefix = word.toLowerCase();
      return nextWords((name ?? '').toLowerCase(), given)
        .filter((candidate) => candidate.startsWith(prefix))
        .toSorted(compareWords);
    },
  };
}
