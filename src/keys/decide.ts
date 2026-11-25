/**
 * What a key press does (decisions 6 and 18): the pure step from the current
 * mode, an optional pending prefix, a canonical chord (see ./chord) and the
 * generated keymap (see ./keymap) to one decision. The app's keydown handler
 * performs the outcome; nothing here touches the DOM, React or the command
 * layer.
 *
 * Without a prefix, mode changes come first: ./mode owns `Escape`, `i` and
 * `Enter`, so a keymap entry can never shadow the chords that switch between
 * the two modes. With a prefix pending, the next chord only continues it or
 * cancels it; the mode chords mean nothing in the middle of a sequence.
 */

import { type InputMode, nextMode } from './mode';
import { hasContinuation } from './sequence';
import type { Keymap, KeymapEntry } from '../commands/bindingTypes';

/** What pressing a chord in a mode achieves. */
export type KeyDecision =
  | { readonly kind: 'mode'; readonly mode: InputMode }
  | { readonly kind: 'run'; readonly line: string }
  | { readonly kind: 'prefill'; readonly line: string }
  | { readonly kind: 'pending'; readonly prefix: string }
  | { readonly kind: 'cancel' }
  | { readonly kind: 'none' };

/** The decision for a complete binding: run its line, or fill it into the command line. */
function entryDecision(entry: KeymapEntry): KeyDecision {
  return entry.prefill ? { kind: 'prefill', line: entry.line } : { kind: 'run', line: entry.line };
}

/**
 * What {@link sequence} means in {@link map}: its entry to run or prefill, a
 * pending prefix when longer bindings continue it, else null.
 */
function lookup(map: ReadonlyMap<string, KeymapEntry>, sequence: string): KeyDecision | null {
  const entry = map.get(sequence);
  if (entry !== undefined) {
    return entryDecision(entry);
  }
  return hasContinuation(map.keys(), sequence) ? { kind: 'pending', prefix: sequence } : null;
}

/**
 * Decide {@link chord} pressed in {@link mode} with no prefix pending: a mode
 * change wins, else the binding of that mode's map — to run, or to fill into
 * the command line when the binding is a prefill — else a pending prefix when
 * longer bindings begin with the chord, else nothing.
 */
export function decideKey(mode: InputMode, chord: string, keymap: Keymap): KeyDecision {
  const changed = nextMode(mode, chord);
  if (changed !== null) {
    return { kind: 'mode', mode: changed };
  }
  return lookup(keymap[mode], chord) ?? { kind: 'none' };
}

/**
 * Decide {@link chord} pressed while {@link pending} waits in {@link map}:
 * `Escape` cancels, else the longer sequence runs, prefills or stays pending,
 * and a chord that continues nothing cancels.
 */
export function continueKey(
  map: ReadonlyMap<string, KeymapEntry>,
  pending: string,
  chord: string,
): KeyDecision {
  if (chord === 'Escape') {
    return { kind: 'cancel' };
  }
  return lookup(map, `${pending} ${chord}`) ?? { kind: 'cancel' };
}
