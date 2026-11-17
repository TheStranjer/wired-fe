/**
 * Argument words (decision 6): command argument text is whitespace-separated
 * words, and several commands read it the same way — so the one split lives
 * here (AGENTS.md "Layout": src/lib holds pure helpers) instead of in every
 * definition that parses an argument. Pure: no state, no I/O.
 */

/** The argument text split into its whitespace-separated words; no arguments, no words. */
export function wordsOf(args: string): readonly string[] {
  const trimmed = args.trim();
  return trimmed === '' ? [] : trimmed.split(/\s+/u);
}
