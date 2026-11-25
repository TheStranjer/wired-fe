/**
 * The vocabulary shared by a post card's action bar and its more-menu
 * (WFE-209): one command line a click runs, and the lines by command name.
 * The ui twin of what src/commands/postActions builds from the registry; this
 * layer may not import that one (AGENTS.md "Layout"), the shapes just match.
 */

/** One command line for a click target, and whether it only fills the input. */
export type PostActionLine = {
  /** The line, e.g. `/boost a3`. */
  readonly line: string;
  /** True fills the line into the command line for the user to finish. */
  readonly prefill: boolean;
};

/** The line each command runs on the card's post, by command name; a command the
 * backend cannot do has none, and its button or row is left out. */
export type PostActionLines = Readonly<Partial<Record<string, PostActionLine>>>;
