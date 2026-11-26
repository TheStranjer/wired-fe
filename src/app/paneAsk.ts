/**
 * What a pane-menu row that needs one argument asks for in its dialog
 * (WFE-269), and how the answer becomes the argument. Pure.
 */

/** What a row that needs one argument asks for, in a dialog, before it runs. */
export type PaneAsk = {
  /** The dialog's title, e.g. `Open profile`. */
  readonly title: string;
  /** What the empty field hints at. */
  readonly placeholder: string;
  /** Which completion words the field suggests, and how its answer is cleaned up; null for plain text. */
  readonly suggest: 'accounts' | 'tags' | null;
};

/** {@link answer} as the argument of an `ask` row: no `#` before a tag, an `@` before an account. */
export function askedArgument(suggest: PaneAsk['suggest'], answer: string): string {
  const typed = answer.trim();
  switch (suggest) {
    case 'tags':
      return typed.replace(/^#/u, '');
    case 'accounts':
      return typed.startsWith('@') ? typed : `@${typed}`;
    case null:
      return typed;
  }
}
