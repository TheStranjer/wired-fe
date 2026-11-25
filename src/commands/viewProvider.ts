/**
 * Tab completion of the view names after `/vsplit` and `/split` (decision 6):
 * the first argument completes to the view words of src/commands/viewSpec.
 * Later words are the open commands' own arguments (`@handle`, `#tag`), which
 * the providers of the buffers' words already complete anywhere in the line.
 */

import type { Provider } from './complete';
import { VIEW_WORDS } from './viewSpec';
import { compareWords } from '../lib/words';

/** A line that is a split command and its first, unfinished argument. */
const FIRST_ARGUMENT = /^\s*\/(?:vsplit|vs|split|sp)\s+\S*$/iu;

/** The provider for the first word after a split command: the view words that start with it. */
export function viewProvider(): Provider {
  return {
    accepts: (_word, isFirstWord, line) => !isFirstWord && FIRST_ARGUMENT.test(line ?? ''),
    candidates: (word) => {
      const prefix = word.toLowerCase();
      return VIEW_WORDS.filter((view) => view.startsWith(prefix)).toSorted(compareWords);
    },
  };
}
