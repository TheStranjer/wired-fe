/**
 * The vocabulary shared by a post card's action bar and its more-menu
 * (WFE-209): one command line a click runs, and the lines by command name.
 * The ui twin of what src/commands/postActions builds from the registry; this
 * layer may not import that one (AGENTS.md "Layout"), the shapes just match.
 */
import type { PickerData } from './emojiPickerModel';

/** One command line for a click target, and what a click does with it. */
export type PostActionLine = {
  /** The line, e.g. `/boost a3`. */
  readonly line: string;
  /** True fills the line into the command line for the user to finish. */
  readonly prefill: boolean;
  /** True opens the emoji picker on a click instead of handing the line on (WFE-265). */
  readonly picker?: true;
  /** Present when a click asks first in a dialog (WFE-266): which question. */
  readonly confirm?: 'delete' | 'block';
};

/** The line each command runs on the card's post, by command name; a command the
 * backend cannot do has none, and its button or row is left out. */
export type PostActionLines = Readonly<Partial<Record<string, PostActionLine>>>;

/** What the react button's picker needs from the app (WFE-265). */
export type ReactPicker = {
  /** The emoji it offers: the post's account's custom ones and the Unicode ones. */
  readonly data: PickerData;
  /** Called when the picker opens, so the app can fetch its emoji. */
  readonly onOpen: () => void;
  /** Called with the chosen emoji, and true when choosing it takes the viewer's reaction back. */
  readonly onChoose: (emoji: string, remove: boolean) => void;
};
