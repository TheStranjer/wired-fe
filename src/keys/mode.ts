/**
 * The insert/navigation mode state machine.
 *
 * Insert mode types into the command line; `Escape` enters navigation mode,
 * where single keys act; `i` or `Enter` returns to insert mode. This module is
 * the pure transition over canonical chord strings (see `./chord`): no event
 * listeners, no React.
 */

/** Which mode the keyboard is in. */
export type InputMode = 'insert' | 'navigation';

/**
 * The mode after pressing `chord` in `mode`, or null when the chord does not
 * change mode. Chords are compared exactly as canonical strings, so `Shift+i`
 * is not `i`, and the navigation chords do nothing while typing in insert.
 */
export function nextMode(mode: InputMode, chord: string): InputMode | null {
  switch (mode) {
    case 'insert':
      return chord === 'Escape' ? 'navigation' : null;
    case 'navigation':
      return chord === 'i' || chord === 'Enter' ? 'insert' : null;
  }
}
