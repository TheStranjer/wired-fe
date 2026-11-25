/**
 * Prefix relations between binding sequences (decision 18): a sequence is
 * canonical chords joined by single spaces (see ./chord `parseSequence`), so
 * "A is a prefix of B" is a plain string test on a space boundary. The keymap
 * uses it to refuse bindings that cannot coexist (`w` beside `w v`), and the
 * key decision uses it to know whether a pressed prefix is still going
 * somewhere. Pure: no events, no keymap.
 */

/** Whether {@link sequence} is longer than {@link prefix} and begins with all its chords. */
export function startsSequence(sequence: string, prefix: string): boolean {
  return sequence.startsWith(`${prefix} `);
}

/**
 * The first of {@link keys} that is a strict prefix of {@link sequence} or has
 * it as a strict prefix, or null when none is. An equal sequence is not a
 * conflict here: duplicates are the keymap's own rule.
 */
export function conflictingSequence(keys: Iterable<string>, sequence: string): string | null {
  for (const key of keys) {
    if (startsSequence(key, sequence) || startsSequence(sequence, key)) {
      return key;
    }
  }
  return null;
}

/** Whether any of {@link keys} continues {@link prefix}, i.e. pressing it leads somewhere. */
export function hasContinuation(keys: Iterable<string>, prefix: string): boolean {
  for (const key of keys) {
    if (startsSequence(key, prefix)) {
      return true;
    }
  }
  return false;
}
