/**
 * Tab completion of the view names after `/vsplit`, `/split` and `/float`
 * (decision 6): the first argument completes to the view words of
 * src/commands/viewSpec, and after `/float` also to `move` and `size`.
 * Later words are the open commands' own arguments (`@handle`, `#tag`), which
 * the providers of the buffers' words already complete anywhere in the line.
 */

import type { Provider } from './complete';
import { VIEW_WORDS } from './viewSpec';
import { compareWords } from '../lib/words';

/** A line that is a split or float command and its first, unfinished argument. */
const FIRST_ARGUMENT = /^\s*\/(?:vsplit|vs|split|sp|float)\s+\S*$/iu;

/** The text in front of the word being a `/float` command, which also takes `move` and `size`. */
const AFTER_FLOAT = /^\s*\/float\s+$/iu;

/** The words `/float` takes besides the views. */
const FLOAT_WORDS: readonly string[] = ['move', 'size'];

/** The provider for the first word after a split or float command: the view words (and `/float`'s own) that start with it. */
export function viewProvider(): Provider {
  return {
    accepts: (_word, isFirstWord, line) => !isFirstWord && FIRST_ARGUMENT.test(line ?? ''),
    candidates: (word, before = '') => {
      const prefix = word.toLowerCase();
      const words = AFTER_FLOAT.test(before) ? [...VIEW_WORDS, ...FLOAT_WORDS] : VIEW_WORDS;
      return words.filter((view) => view.startsWith(prefix)).toSorted(compareWords);
    },
  };
}
