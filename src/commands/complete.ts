/**
 * Tab completion for the command line (decision 6): the engine. On the first
 * Tab it finds the run of non-whitespace characters ending at the cursor, asks
 * the first provider that accepts that word for its full replacement words
 * and puts the first of them into the text; every further Tab cycles through
 * the list, wrapping at both ends. Providers for commands, accounts, hashtags,
 * windows and posts are built by their own modules and passed in, so this
 * module knows no word of its own. The suggestion list (./suggest) reads the
 * same candidates through {@link candidatesAt}.
 */

/** Characters that separate two words on the command line. */
const WHITESPACE = /\s/;

/** What a completed word is followed by, so the next one can be typed. */
const WORD_SEPARATOR = ' ';

/**
 * How a suggestion list shows one candidate (WFE-297): {@link word} is what
 * the row completes to, {@link label} how the row names it (a command and its
 * aliases), {@link description} one line about it (empty for none) and
 * {@link image} the URL of a picture shown beside the label (an emoji).
 * Candidates that share a {@link word} share one row.
 */
export type Described = {
  readonly word: string;
  readonly label: string;
  readonly description: string;
  readonly image?: string;
};

/**
 * One kind of word the command line can complete. {@link accepts} decides
 * whether a word belongs to this provider, by its prefix character and by
 * whether it is the line's first word; {@link candidates} answers with every
 * full replacement word for it, sorted.
 */
export type Provider = {
  /** True when this provider handles a word with this prefix character, e.g. '@', ':', '#', '/'. */
  readonly accepts: (word: string, isFirstWord: boolean, line?: string) => boolean;
  /**
   * Every full replacement word for {@link word}, sorted; empty when none
   * match. {@link before} is the line's text in front of the word, for
   * providers whose words depend on the ones already typed.
   */
  readonly candidates: (word: string, before?: string) => readonly string[];
  /**
   * The row a suggestion list shows for one of {@link candidates}; undefined
   * for a word with nothing to say. A provider without it has no list.
   */
  readonly describe?: (candidate: string) => Described | undefined;
  /** True when the provider is also asked about the empty word after a space (`/fav `). */
  readonly bare?: true;
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

/**
 * What the providers offer for the word ending at a cursor in {@link text}:
 * the {@link provider} that accepted it and its sorted {@link candidates}, for
 * the word spanning {@link wordStart} up to {@link end}.
 */
type Found = {
  readonly text: string;
  readonly provider: Provider;
  readonly candidates: readonly string[];
  readonly wordStart: number;
  readonly end: number;
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

/** The completion of {@link found} that has not replaced anything yet. */
function stateOf(found: Found): CompletionState {
  const { text, candidates, wordStart, end } = found;
  return { original: text, cursor: end, candidates, index: 0, wordStart };
}

/**
 * The candidates for the word ending at {@link cursor}: the first provider that
 * accepts the word answers, and a later one is never asked. Null when there is
 * no word (only a bare provider is asked about one), no provider accepts it,
 * or the accepting provider has nothing to offer.
 */
export function candidatesAt(
  text: string,
  cursor: number,
  providers: readonly Provider[],
): Found | null {
  const end = clampedCursor(text, cursor);
  const wordStart = wordStartBefore(text, end);
  const word = text.slice(wordStart, end);
  const provider = providers.find(
    (one) => (word !== '' || one.bare === true) && one.accepts(word, wordStart === 0, text),
  );
  if (provider === undefined) {
    return null;
  }
  const candidates = provider.candidates(word, text.slice(0, wordStart));
  return candidates.length === 0 ? null : { text, provider, candidates, wordStart, end };
}

/** The text and caret of {@link found} with {@link word} written in place of the word it completes. */
export function completeTo(
  found: Found,
  word: string,
): { readonly text: string; readonly cursor: number } {
  const { text, cursor } = showing(stateOf(found), word);
  return { text, cursor };
}

/**
 * Complete the word ending at {@link cursor}: the first provider that accepts
 * it replaces the word with its first candidate plus a space, and the returned
 * state cycles through the rest. Null when there is no word, no provider
 * accepts it, or the accepting provider has nothing to offer.
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
  const found = candidatesAt(text, cursor, providers);
  const first = found?.candidates[0];
  return found === null || first === undefined ? null : showing(stateOf(found), first);
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
