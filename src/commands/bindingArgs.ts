/**
 * The helpers the key-binding commands share (WFE-130): `/bind`, `/unbind`
 * and `/binds` all name one of the two hotkey modes, all read the mode word
 * the same way, and both setters store the reader's override list through
 * the same rule and the same `settings` action. The argument split itself is
 * src/lib/words; the override shape is src/lib/keyOverride.
 */

import type { BindingMode } from './bindingTypes';
import type { CommandContext } from './types';
import type { KeyOverride } from '../lib/keyOverride';

/** The mode the word names, or null when it names neither of the two hotkey modes. */
export function modeOf(word: string | undefined): BindingMode | null {
  return word === 'insert' || word === 'navigation' ? word : null;
}

/**
 * Store {@link override} as the reader's own binding: a line binds, replacing
 * the override the reader made for that mode and chord; a null line unbinds —
 * dropping the reader's own override so the command's default stands again,
 * or, where there was none to drop, recording the null line so the chord
 * stays unbound over every rebuild.
 */
export function storeRebind(context: CommandContext, override: KeyOverride): void {
  const overrides = context.state.settings.keyOverrides;
  const kept = overrides.filter(
    (existing) => existing.mode !== override.mode || existing.chord !== override.chord,
  );
  const next =
    override.line !== null || kept.length === overrides.length ? [...kept, override] : kept;
  context.dispatch({ type: 'settings', settings: { keyOverrides: next } });
}

/**
 * Split the words after the mode word of `/bind` into the key sequence and
 * the command line (decision 18): the sequence is the first word, which is
 * always a chord — `/` itself is one —, plus every word up to the first that
 * starts with `/`; the line is that word and everything after it. With no such
 * word the line is whatever follows the first chord, for the caller to refuse.
 */
export function splitBinding(words: readonly string[]): {
  readonly chords: string;
  readonly line: string;
} {
  const slash = words.findIndex((word, index) => index > 0 && word.startsWith('/'));
  const cut = slash === -1 ? 1 : slash;
  return { chords: words.slice(0, cut).join(' '), line: words.slice(cut).join(' ') };
}
