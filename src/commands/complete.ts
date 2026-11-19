/**
 * Tab completion for the command line (decision 6): the engine plus the one
 * provider this layer can build itself, the command list read from the
 * registry. On the first Tab the engine finds the run of non-whitespace
 * characters ending at the cursor, asks the first provider that accepts that
 * word for its full replacement words and puts the first of them into the
 * text; every further Tab cycles through the list, wrapping at both ends.
 * Providers for accounts, hashtags, windows and posts are built by their own
 * layers and passed in, so this module only ever knows the command registry.
 */

import type { Registry } from './types';

/** Characters that separate two words on the command line. */
const WHITESPACE = /\s/;

/** What a command word is written with in front of its name. */
const COMMAND_PREFIX = '/';

/** What a completed word is followed by, so the next one can be typed. */
const WORD_SEPARATOR = ' ';

/**
 * One kind of word the command line can complete. {@link accepts} decides
 * whether a word belongs to this provider, by its prefix character and by
 * whether it is the line's first word; {@link candidates} answers with every
 * full replacement word for it, sorted.
 */
export type Provider = {
  /** True when this provider handles a word with this prefix character, e.g. '@', ':', '#', '/'. */
  readonly accepts: (word: string, isFirstWord: boolean) => boolean;
  /** Every full replacement word for {@link word}, sorted; empty when none match. */
  readonly candidates: (word: string) => readonly string[];
};

/**
 * A completion in progress: the text as it was before the first replacement
 * ({@link original}) and where the completed word sat in it
 * ({@link wordStart} up to {@link cursor}), plus the list to cycle through and
 * which candidate is showing ({@link index}). {@link cycleCompletion} always
 * rewrites {@link original}, so cycling replaces the candidate instead of
 * appending to it.
 */
export type CompletionState = {
  readonly original: string;
  readonly cursor: number;
  readonly candidates: readonly string[];
  readonly index: number;
  readonly wordStart: number;
};

/** {@link cursor} as an offset into {@link text}: both ends clamped. */
function clampedCursor(text: string, cursor: number): number {
  return Math.max(0, Math.min(cursor, text.length));
}

/**
 * Where the run of non-whitespace characters ending at {@link end} starts in
 * {@link text}: the offset of the first character after the last whitespace.
 */
function wordStartBefore(text: string, end: number): number {
  let start = end;
  while (start > 0 && !WHITESPACE.test(text.slice(start - 1, start))) {
    start -= 1;
  }
  return start;
}

/**
 * {@link state}'s text with its candidate in place of the completed word, a
 * space behind it and everything after the cursor kept as it was.
 */
function showing(
  state: CompletionState,
  candidate: string,
): {
  readonly text: string;
  readonly cursor: number;
  readonly state: CompletionState;
} {
  const before = state.original.slice(0, state.wordStart);
  const after = state.original.slice(state.cursor);
  return {
    text: `${before}${candidate}${WORD_SEPARATOR}${after}`,
    cursor: state.wordStart + candidate.length + WORD_SEPARATOR.length,
    state,
  };
}

/**
 * Complete the word ending at {@link cursor}: the first provider that accepts
 * it replaces the word with its first candidate plus a space, and the returned
 * state cycles through the rest. Null when there is no word, no provider
 * accepts it, or the accepting provider has nothing to offer; a later provider
 * is never asked once one has accepted the word.
 */
export function startCompletion(
  text: string,
  cursor: number,
  providers: readonly Provider[],
): {
  readonly text: string;
  readonly cursor: number;
  readonly state: CompletionState;
} | null {
  const end = clampedCursor(text, cursor);
  const wordStart = wordStartBefore(text, end);
  const word = text.slice(wordStart, end);
  if (word === '') {
    return null;
  }
  const chosen = providers.find((provider) => provider.accepts(word, wordStart === 0));
  if (chosen === undefined) {
    return null;
  }
  const candidates = chosen.candidates(word);
  const first = candidates[0];
  if (first === undefined) {
    return null;
  }
  return showing({ original: text, cursor: end, candidates, index: 0, wordStart }, first);
}

/**
 * Show the next candidate (`1`) or the previous one (`-1`) of {@link state},
 * wrapping at both ends. A state with an empty candidate list has nothing to
 * cycle and is returned with its original text.
 */
export function cycleCompletion(
  state: CompletionState,
  direction: 1 | -1,
): { readonly text: string; readonly cursor: number; readonly state: CompletionState } {
  const count = state.candidates.length;
  const index = count === 0 ? 0 : (state.index + direction + count) % count;
  const candidate = state.candidates[index];
  if (candidate === undefined) {
    return { text: state.original, cursor: state.cursor, state };
  }
  return showing({ ...state, index }, candidate);
}

/** Sort command words the way the registry and `/help` list them. */
function compareWords(a: string, b: string): number {
  return a.localeCompare(b);
}

/** Every name and alias of {@link registry}, each written as it is completed. */
function commandWords(registry: Registry): string[] {
  const words: string[] = [];
  for (const definition of registry.commands) {
    words.push(`/${definition.name}`);
    for (const alias of definition.aliases ?? []) {
      words.push(`/${alias}`);
    }
  }
  return words;
}

/**
 * The provider for commands: the line's first word starting with `/` completes
 * to `/name` for every name and alias that starts with it, because the
 * registry is the one source of both (decision 6). Registry names are already
 * lowercase, so only the typed word is lowercased before matching, the way
 * parseInput does; a bare `/` offers every command.
 */
export function commandProvider(registry: Registry): Provider {
  const words = commandWords(registry);

  return {
    accepts: (word, isFirstWord) => isFirstWord && word.startsWith(COMMAND_PREFIX),
    candidates: (word) => {
      const prefix = word.toLowerCase();
      return words.filter((candidate) => candidate.startsWith(prefix)).toSorted(compareWords);
    },
  };
}
