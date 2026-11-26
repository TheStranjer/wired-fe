/**
 * The keyboard of the account picker (WFE-282). {@link useDigitSelect}: while
 * focus is anywhere in a form, the keys `1` to `9` choose the nth of its keys,
 * moving focus to that radio so the arrow keys carry on from there; keys held
 * with Ctrl, Alt or Meta, and digits past the last choice, are left alone. The
 * listener sits on the form itself, as the Overlay's does, because the strict
 * jsx-a11y gate forbids a keydown handler on a non-interactive element in JSX.
 * {@link useChosenFocus}: focus the checked account radio as the form mounts.
 */
import { type RefObject, useEffect, useLayoutEffect } from 'react';

/** The radios of the accounts group. */
const ACCOUNT_RADIOS = 'input[name="account"]';

/** The 1-based position a key names, or null when it is no digit from 1 to 9. */
function positionOf(event: KeyboardEvent): number | null {
  if (event.ctrlKey || event.altKey || event.metaKey || !/^[1-9]$/u.test(event.key)) {
    return null;
  }
  return Number(event.key);
}

/** Make `1`-`9` choose the nth of {@link keys} inside {@link form}, calling {@link choose} with its key. */
export function useDigitSelect(
  form: RefObject<HTMLFormElement | null>,
  keys: readonly string[],
  choose: (key: string) => void,
): void {
  useEffect(() => {
    const box = form.current;
    if (box === null) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      const position = positionOf(event);
      const key = position === null ? undefined : keys[position - 1];
      if (position === null || key === undefined) {
        return;
      }
      event.preventDefault();
      choose(key);
      const radios = [...box.querySelectorAll<HTMLInputElement>(ACCOUNT_RADIOS)];
      for (const radio of radios.slice(position - 1, position)) {
        radio.focus();
      }
    };
    box.addEventListener('keydown', onKeyDown);
    return (): void => {
      box.removeEventListener('keydown', onKeyDown);
    };
  }, [form, keys, choose]);
}

/**
 * Give focus to the checked account radio of {@link form} as it mounts. Call
 * it from the component that renders the Overlay: an ancestor's layout effect
 * runs after the Overlay's own, which focuses the first field, so this wins.
 */
export function useChosenFocus(form: RefObject<HTMLFormElement | null>): void {
  useLayoutEffect(() => {
    const box = form.current;
    if (box === null) {
      return;
    }
    for (const radio of box.querySelectorAll<HTMLInputElement>(`${ACCOUNT_RADIOS}:checked`)) {
      radio.focus();
    }
  }, [form]);
}
