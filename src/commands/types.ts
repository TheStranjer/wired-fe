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

import type { AccountStore } from '../accounts/accountStore';
import type { WiredConfig } from '../config/schema';
import type { AppState } from '../state/appState';
import type { Draft } from '../state/draft';
import type { AppAction } from '../state/reducer';
import type { Store } from '../storage/store';
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
 * Everything a command may do: talk to the user, read the command list, read
 * and change the window list, read and move the whole app state, post through
 * the active window, rewrite the command line, navigate, and reach the
 * persisted stores and the build-time configuration. The app builds one per run.
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
  /** The whole app state as it is while the command runs. */
  readonly state: AppState;
  /** Ask the application's one reducer for a transition. */
  readonly dispatch: (action: AppAction) => void;
  /** The current moment, so printed lines and posts can be stamped. */
  readonly now: () => Date;
  /** Posts through the active window (its kind's post handler). Resolves to an error message or null. */
  readonly post: (draft: Draft) => Promise<string | null>;
  /** Replaces the command-line text (used by prefill hotkeys and /edit). */
  readonly setInput: (text: string) => void;
  /** Goes to a view by URL, e.g. a hash route (decision 4). */
  readonly navigate: (url: string) => void;
  /** Where the page is right now, for building and comparing URLs. */
  readonly page: { readonly origin: string; readonly pathname: string };
  /** The build-time configuration of this bundle (decision 3). */
  readonly config: WiredConfig;
  /** The persisted stores a command may read and write (decision 10). */
  readonly stores: {
    readonly apps: Store;
    readonly login: Store;
    readonly accounts: AccountStore;
    readonly settings: Store;
  };
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
