/**
 * Word splitting for command arguments: the one place a command line's first
 * word is cut from the text that follows it.
 */

/**
 * {@link args} trimmed and split at the first whitespace into its leading word
 * and what follows it, trimmed. With no gap the word is all of args and the
 * rest is `''`; a trimmed string ends in a non-space, so a gap always leaves a
 * non-empty rest.
 */
export function splitFirstWord(args: string): readonly [word: string, rest: string] {
  const trimmed = args.trim();
  const gap = trimmed.search(/\s/u);
  return gap === -1 ? [trimmed, ''] : [trimmed.slice(0, gap), trimmed.slice(gap).trim()];
}
