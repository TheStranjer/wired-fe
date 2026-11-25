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
import type { MediaAttachment } from '../api/schemas/mediaAttachment';
import type { Capabilities, FeatureFlag } from '../capabilities/capabilities';
import type { WiredConfig } from '../config/schema';
import type { DeviceClass } from '../lib/deviceClass';
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
  /** Names of commands the active backend cannot do (WFE-172), so typing one says why. */
  readonly hidden?: ReadonlyMap<string, CommandDefinition>;
};

/**
 * Everything a command may do: talk to the user, read the commands (only those
 * the active backend can do, WFE-172), change windows and app state, post
 * through the active window, rewrite the command line, open the composer,
 * attach media (WFE-126), read key bindings (WFE-130), navigate, and reach the
 * stores and the build configuration. The app builds one per run.
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
  /** Opens the composer overlay for a long post, filled with {@link initialText} (WFE-125). */
  readonly openComposer: (initialText: string) => void;
  /**
   * The media waiting for the next post (WFE-126): {@link pick} opens the
   * app's file dialog asking for alt text to give whatever is chosen,
   * {@link clear} drops everything pending, and {@link pending} is what a
   * post without its own media ids carries.
   */
  readonly attachments: {
    readonly pick: (description: string) => void;
    readonly clear: () => void;
    readonly pending: readonly MediaAttachment[];
  };
  /** The keys layer's helpers (WFE-130): chord parsing, the insert-mode guard, the effective keymap. */
  readonly keys: {
    readonly parseChord: (text: string) => string | null;
    readonly blocksTyping: (chord: string) => boolean;
    readonly keymap: Keymap;
  };
  /** Goes to a view by URL, e.g. a hash route (decision 4). */
  readonly navigate: (url: string) => void;
  /** Where the page is right now, for building and comparing URLs. */
  readonly page: { readonly origin: string; readonly pathname: string };
  /** The class of the device running the app (decision 17). */
  readonly deviceClass: DeviceClass;
  /** The build-time configuration of this bundle (decision 3). */
  readonly config: WiredConfig;
  /** The persisted stores a command may read and write (decision 10). */
  readonly stores: {
    readonly apps: Store;
    readonly login: Store;
    readonly accounts: AccountStore;
    readonly settings: Store;
    /** Per-session store (`sessionStorage`) of the instance profiles detected this session (decision 5). */
    readonly profiles: Store;
  };
};

/** Which keyboard mode a default binding is active in (decision 6). */
export type BindingMode = 'insert' | 'navigation';

/** One keymap entry: a chord's command line, run or filled into the input. */
export type KeymapEntry = {
  /** The command line the chord carries, e.g. `/win 3` or `/reply {label}`. */
  readonly line: string;
  /** True fills the line into the command line (a prefill binding), false runs it. */
  readonly prefill: boolean;
};

/** The two hotkey maps and what went wrong building them (src/keys/keymap.ts); `/binds` reads one (WFE-130). */
export type Keymap = {
  /** Chord -> entry while typing in the command line, e.g. `Alt+3` -> `/win 3`. */
  readonly insert: ReadonlyMap<string, KeymapEntry>;
  /** Chord -> entry while navigating. */
  readonly navigation: ReadonlyMap<string, KeymapEntry>;
  /** Human-readable reasons a binding was refused, in registry order. */
  readonly problems: readonly string[];
};

/** One default key binding: in {@link mode}, {@link chord} runs `/name args` (or fills it when {@link prefill}). */
export type CommandBinding = {
  readonly mode: BindingMode;
  /** Canonical chord, e.g. `Alt+3` (see src/keys/chord.ts). */
  readonly chord: string;
  /** Argument text appended to `/name `, may be `''`. */
  readonly args: string;
  /**
   * When true the chord does not run its line: it fills it into the command
   * line for the user to finish (AGENTS.md "prefill bindings"). `{label}` in
   * the args stands for the selected post's label. Absent means run.
   */
  readonly prefill?: boolean;
};

/** One command, exactly as a file in defs/ exports it. */
export type CommandDefinition = {
  /** The name without its slash: a letter, then letters, digits, hyphens. */
  readonly name: string;
  /** Alternative names, each matching the same pattern as {@link name}; none when omitted. */
  readonly aliases?: readonly string[];
  /** How to call it, one line, e.g. `/win <number>`. */
  readonly usage: string;
  /** One line for /help. */
  readonly summary: string;
  /** Do the thing. `args` is the raw argument text after the name. */
  readonly run: (args: string, context: CommandContext) => Promise<CommandOutcome>;
  /** Default key bindings this command declares; absent means none. */
  readonly bindings?: readonly CommandBinding[];
  /** Flags the backend must all carry for the command to exist (WFE-172); absent: any backend. */
  readonly requires?: FeatureFlag | readonly FeatureFlag[];
  /** The {@link usage} for a backend's capabilities (null: unknown); absent: always {@link usage}. */
  readonly usageFor?: (capabilities: Capabilities | null) => string;
};
