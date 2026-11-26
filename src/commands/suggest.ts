/**
 * The rows of the live suggestion list under the command line (WFE-297): what
 * the first provider that accepts the word at the caret would complete it to,
 * one row per described word (a command and its aliases share one), every one
 * of them (the list scrolls, WFE-306). It reads the same
 * candidates Tab does (./complete), so the list and the completion cannot
 * disagree, and it only exists for providers that describe their words. While
 * Tab is cycling it follows the completion, not the line, so the list stays
 * up and its highlight steps with the key.
 */

import { type CompletionState, type Provider, candidatesAt, completeTo } from './complete';

/** One row: {@link words} are every candidate it stands for, {@link word} the one a click completes to. */
type Suggestion = {
  readonly word: string;
  readonly label: string;
  readonly description: string;
  readonly image?: string;
  readonly detail?: string;
  readonly words: readonly string[];
};

/** The list as it is drawn: every row, and the row Tab is on. */
export type SuggestionView = {
  readonly rows: readonly Suggestion[];
  /** The index into {@link rows} of the row whose candidate is in the line, -1 for none. */
  readonly active: number;
  /** The line and caret after completing to {@link Suggestion.word}. */
  readonly pick: (word: string) => { readonly text: string; readonly cursor: number };
};

/** The candidate a completion in progress has put into the line, if there is one. */
function showingNow(completing: CompletionState | null): string | undefined {
  return completing === null ? undefined : completing.candidates[completing.index];
}

/** One row per described word, in the order its first candidate comes. */
function rowsOf(
  describe: NonNullable<Provider['describe']>,
  candidates: readonly string[],
): readonly Suggestion[] {
  const rows = new Map<string, Suggestion>();
  for (const candidate of candidates) {
    const note = describe(candidate) ?? { word: candidate, label: candidate, description: '' };
    const words = [...(rows.get(note.word)?.words ?? []), candidate];
    rows.set(note.word, { ...note, words });
  }
  return [...rows.values()];
}

/**
 * The list for the word at the caret {@link at} (a cursor offset into a
 * text); null when no provider with descriptions accepts it.
 * {@link completing} is the Tab completion that wrote the text, if one did:
 * the list is then the one of the word that completion started from.
 */
export function suggestionView(
  at: { readonly text: string; readonly cursor: number },
  providers: readonly Provider[],
  completing: CompletionState | null,
): SuggestionView | null {
  const from = completing === null ? at : { text: completing.original, cursor: completing.cursor };
  const found = candidatesAt(from.text, from.cursor, providers);
  const describe = found?.provider.describe;
  if (found === null || describe === undefined) {
    return null;
  }
  const rows = rowsOf(describe, found.candidates);
  const now = showingNow(completing);
  const active = rows.findIndex((row) => now !== undefined && row.words.includes(now));
  return { rows, active, pick: (word) => completeTo(found, word) };
}
