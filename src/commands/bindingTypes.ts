/**
 * The key-binding vocabulary of the command layer (decision 6): the default
 * bindings a command declares and the keymaps built from them
 * (src/keys/keymap.ts). Kept apart from types.ts, which imports it.
 */

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
