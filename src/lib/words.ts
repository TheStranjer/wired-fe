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

/** Orders two words the way the registry, `/help` and completion list them. */
export function compareWords(a: string, b: string): number {
  return a.localeCompare(b);
}
