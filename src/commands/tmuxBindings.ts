/**
 * The tmux-style default layout keys (decision 18): `Ctrl+B` starts a sequence
 * and the next key picks the command. Each command declares its own keys in
 * its `bindings`; this module only spells the prefix and the two modes once.
 * The prefix is `Ctrl+b` because chords are canonical (see src/keys/chord).
 */

import type { CommandBinding } from './bindingTypes';

/** The canonical prefix chord of every tmux-style binding. */
const PREFIX = 'Ctrl+b';

/**
 * The `Ctrl+B <key>` binding running the command with {@link args}, in insert
 * and in navigation mode. {@link key} is a canonical chord: `%`, `ArrowLeft`, `x`.
 */
export function tmuxBindings(key: string, args: string): readonly CommandBinding[] {
  return [
    { mode: 'insert', chord: `${PREFIX} ${key}`, args },
    { mode: 'navigation', chord: `${PREFIX} ${key}`, args },
  ];
}
