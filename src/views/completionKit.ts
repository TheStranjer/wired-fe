/**
 * The pieces the completion providers of ./completionProviders are built
 * from (WFE-124, WFE-300): matching a typed word against a list, appending
 * what the instance's search found below what the buffers showed, and the
 * row a suggestion list draws for a word.
 */

import type { NamedWord } from './seenWords';
import { compareWords } from '../lib/words';

/** The most candidates one word may offer, newest lists stay cheap to show. */
const MAX_CANDIDATES = 50;

/**
 * The row a suggestion list draws for one candidate: the same shape as the
 * Described of src/commands/complete, restated for the layering. {@link word}
 * is what the row completes to, {@link label} its name, {@link description}
 * one line about it (empty for none) and {@link image} the picture shown
 * before the label.
 */
export type CompletionNote = {
  readonly word: string;
  readonly label: string;
  readonly description: string;
  readonly image?: string;
};

/** The accepts of a kind: {@link prefix} and at least {@link rest} more characters. */
export function acceptsWord(prefix: string, rest: number): (word: string) => boolean {
  return (word: string): boolean => word.startsWith(prefix) && word.length >= prefix.length + rest;
}

/**
 * The {@link values} that start with {@link word}, ignoring case: the first
 * spelling of each lowercase form, sorted, at most {@link MAX_CANDIDATES}.
 */
export function completionList(values: readonly string[], word: string): readonly string[] {
  const prefix = word.toLowerCase();
  const seen = new Set<string>();
  const matches: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (key.startsWith(prefix) && !seen.has(key)) {
      seen.add(key);
      matches.push(value);
    }
  }
  return matches.toSorted(compareWords).slice(0, MAX_CANDIDATES);
}

/**
 * {@link first} followed by the {@link extra} words it does not hold yet,
 * ignoring case and each other, in the order they came, at most
 * {@link MAX_CANDIDATES} in all.
 */
export function appended(first: readonly string[], extra: readonly string[]): readonly string[] {
  const known = new Set(first.map((word) => word.toLowerCase()));
  const merged = [...first];
  for (const word of extra) {
    if (!known.has(word.toLowerCase())) {
      known.add(word.toLowerCase());
      merged.push(word);
    }
  }
  return merged.slice(0, MAX_CANDIDATES);
}

/** The row of a word with nothing but its name and a one-line {@link description}. */
export function plainNote(word: string, description: string): CompletionNote {
  return { word, label: word, description };
}

/** A function that computes {@link make} once, on the first call. */
export function once<T>(make: () => T): () => T {
  let made: { readonly value: T } | undefined;
  return () => {
    made ??= { value: make() };
    return made.value;
  };
}

/** The first non-empty name of each word, keyed by its lowercase spelling. */
export function namesOf(words: readonly NamedWord[]): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const { word, name } of words) {
    const key = word.toLowerCase();
    if (name !== '' && !names.has(key)) {
      names.set(key, name);
    }
  }
  return names;
}
