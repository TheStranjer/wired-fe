/**
 * The vocabulary of the command layer (decision 6): one CommandDefinition per
 * action is the single source for the command line, /help, tab completion,
 * the keymap and click targets. Each command lives in its own file under
 * defs/ and self-registers by exporting `command`; definitions.ts collects
 * them and registry.ts indexes the result.
 *
 * This module holds every type of the layer, including the registry shape, so
 * that commands and the registry do not have to import each other.
 */

import type { WindowsState } from '../windows/model';
import type { WindowsAction } from '../windows/reducer';

/** What running a command achieved: success, or a message to show the user. */
export type CommandOutcome =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

/** How a client message is emphasised in the window it is printed into. */
export type PrintLevel = 'info' | 'warn' | 'error';

/** All commands, ready for the command line, /help, completion and the keymap. */
export type Registry = {
  /** Every command, sorted by name. */
  readonly commands: readonly CommandDefinition[];
  /** Every name and every alias, mapped to the definition it belongs to. */
  readonly byName: ReadonlyMap<string, CommandDefinition>;
};

/**
 * Everything a command may do: talk to the user, read the command list and
 * read and change the window list. The app builds one per run.
 */
export type CommandContext = {
  /** Print a client message into the active window; no level means `info`. */
  readonly print: (text: string, level?: PrintLevel) => void;
  /** Every registered command, for /help, completion and command lookups. */
  readonly registry: Registry;
  /** The window list as it is while the command runs. */
  readonly windows: WindowsState;
  /** Ask the window layer to change: open, close, activate, move, mark read. */
  readonly dispatchWindows: (action: WindowsAction) => void;
  /** Empty the scrollback of the active window (`/clear`). */
  readonly clearActiveWindow: () => void;
};

/** Which keyboard mode a default binding is active in (decision 6). */
export type BindingMode = 'insert' | 'navigation';

/**
 * One default key binding of a command: in {@link mode}, pressing
 * {@link chord} runs `/name args`. The keymap is generated from the bindings
 * declared across the registry.
 */
export type CommandBinding = {
  readonly mode: BindingMode;
  /** Canonical chord, e.g. `Alt+3` (see src/keys/chord.ts). */
  readonly chord: string;
  /** Argument text appended to `/name `, may be `''`. */
  readonly args: string;
};

/** One command, exactly as a file in defs/ exports it. */
export type CommandDefinition = {
  /** The name without its slash: a letter, then letters, digits, hyphens. */
  readonly name: string;
  /** Alternative names, each matching the same pattern as {@link name}. */
  readonly aliases: readonly string[];
  /** How to call it, one line, e.g. `/win <number>`. */
  readonly usage: string;
  /** One line for /help. */
  readonly summary: string;
  /** Do the thing. `args` is the raw argument text after the name. */
  readonly run: (args: string, context: CommandContext) => Promise<CommandOutcome>;
  /** Default key bindings this command declares; absent means none. */
  readonly bindings?: readonly CommandBinding[];
};
