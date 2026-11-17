/**
 * The shape of one user key override (WFE-130, AGENTS.md "Every binding is
 * rebindable"): a chord rebound in one mode to one command line, or unbound
 * when the line is null. It lives in src/lib because both the state layer that
 * stores the reader's overrides (src/state/settings) and the keys layer that
 * applies them over the defaults (src/keys/keymap) need exactly this type, and
 * neither layer may import the other.
 */

/** One of the reader's own key bindings; a null line unbinds the chord. */
export type KeyOverride = {
  /** Which of the two hotkey modes (AGENTS.md "Two hotkey modes") it turns. */
  readonly mode: 'insert' | 'navigation';
  /** The canonical chord it speaks for, e.g. `Alt+3` (see src/keys/chord). */
  readonly chord: string;
  /** The command line the chord now carries; null means unbound. */
  readonly line: string | null;
};
