/**
 * The vocabulary of `/focus` and `/swap` (decision 12): the direction words
 * (`left`, or vim's `h`), the cycling words and the candidates Tab offers
 * after either command. The commands and the completion provider read the same
 * lists, so what completes is exactly what the commands accept.
 */

import type { Provider } from './complete';
import { compareWords, wordsOf } from '../lib/words';
import type { FocusStep } from '../windows/paneFocus';
import type { Direction } from '../windows/splitGeometry';

/** The directions, spelled out, in the order Tab offers them. */
const DIRECTION_NAMES: readonly Direction[] = ['left', 'right', 'up', 'down'];

/** Every word that names a direction: the names and the vim letters. */
const DIRECTIONS: ReadonlyMap<string, Direction> = new Map([
  ['left', 'left'],
  ['h', 'left'],
  ['right', 'right'],
  ['l', 'right'],
  ['up', 'up'],
  ['k', 'up'],
  ['down', 'down'],
  ['j', 'down'],
]);

/** The words that cycle through the panes. */
const CYCLES: readonly ('next' | 'prev')[] = ['next', 'prev'];

/** The direction {@link word} names, or null. */
export function directionOf(word: string): Direction | null {
  return DIRECTIONS.get(word) ?? null;
}

/** The step {@link word} names: a direction, or `next` or `prev`; null for anything else. */
export function focusStepOf(word: string): FocusStep | null {
  const cycle = CYCLES.find((candidate) => candidate === word);
  return cycle ?? directionOf(word);
}

/** The commands whose first argument completes, each with the words it takes. */
const COMPLETED = new Map<string, readonly string[]>([
  ['/focus ', [...DIRECTION_NAMES, ...CYCLES]],
  ['/swap ', DIRECTION_NAMES],
]);

/** The words the line's command takes as a first argument, or none. */
function wordsFor(line: string): readonly string[] {
  const typed = line.trimStart().toLowerCase();
  const entry = [...COMPLETED].find(([prefix]) => typed.startsWith(prefix));
  return entry === undefined ? [] : entry[1];
}

/**
 * The provider for `/focus` and `/swap`: after the command and a space, a word
 * completes to the directions (and `next` and `prev` for `/focus`). Only the
 * first argument completes.
 */
export function directionProvider(): Provider {
  return {
    accepts: (_word, isFirstWord, line) => !isFirstWord && wordsFor(line ?? '').length > 0,
    candidates: (word, before) => {
      const typed = before ?? '';
      const prefix = word.toLowerCase();
      return wordsOf(typed).length === 1
        ? wordsFor(typed)
            .filter((candidate) => candidate.startsWith(prefix))
            .toSorted(compareWords)
        : [];
    },
  };
}
