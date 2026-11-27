/**
 * The attributes a signed-out card's action buttons carry (WFE-340): the button
 * is `aria-disabled`, though it stays pressable so the command's own refusal
 * answers the press, and `aria-description` says to sign in. It is built here
 * and spread, because the JSX lint knows no `aria-description` for a button.
 */

/** What a read-only button adds to itself. */
type ReadOnlyProps = {
  readonly 'aria-description'?: string;
  readonly 'aria-disabled'?: true;
};

/** The attributes for a button whose bar is read-only with {@link note}; none when the bar is not. */
export function readOnlyProps(note: string | undefined): ReadOnlyProps {
  return note === undefined ? {} : { 'aria-description': note, 'aria-disabled': true };
}
