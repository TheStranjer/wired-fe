/**
 * What a key press does (decision 6): the pure step from the current mode, a
 * canonical chord (see ./chord) and the generated keymap (see ./keymap) to
 * one decision. The app's keydown handler performs the outcome; nothing here
 * touches the DOM, React or the command layer.
 *
 * Mode changes come first: ./mode owns `Escape`, `i` and `Enter`, so a keymap
 * entry can never shadow the chords that switch between the two modes.
 */

import type { Keymap } from './keymap';
import { type InputMode, nextMode } from './mode';

/** What pressing a chord in a mode achieves. */
export type KeyDecision =
  | { readonly kind: 'mode'; readonly mode: InputMode }
  | { readonly kind: 'run'; readonly line: string }
  | { readonly kind: 'none' };

/**
 * Decide {@link chord} pressed in {@link mode}: a mode change wins, else the
 * command line bound to the chord in that mode's map, else nothing.
 */
export function decideKey(mode: InputMode, chord: string, keymap: Keymap): KeyDecision {
  const changed = nextMode(mode, chord);
  if (changed !== null) {
    return { kind: 'mode', mode: changed };
  }
  const line = keymap[mode].get(chord);
  if (line !== undefined) {
    return { kind: 'run', line };
  }
  return { kind: 'none' };
}
