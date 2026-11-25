/**
 * The keys of the emoji picker (WFE-265). One native `keydown` listener sits on
 * the dialog itself, as {@link Overlay}'s does: the strict jsx-a11y gate
 * forbids one on a `role="dialog"` element in JSX, and every key pressed in
 * the picker stops here so the global hotkeys never fire under it. Escape
 * closes; in the search field ArrowDown steps into the grid and Enter takes the
 * first match; in the grid the arrows, Home and End move and Enter or Space
 * choose.
 */
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { gridTarget } from './emojiPickerModel';

/** What the keys read and ask for, kept current by the picker. */
export type PickerKeys = {
  /** How many cells the grid holds. */
  readonly count: number;
  /** The cell that is the grid's tab stop, where Enter and Space choose. */
  readonly active: number;
  /** Closes the picker. */
  readonly close: () => void;
  /** Chooses the cell at an index. */
  readonly choose: (index: number) => void;
  /** Moves focus to the cell at an index; a negative index is the search field. */
  readonly focusCell: (index: number) => void;
};

/** A key pressed in the search field. */
function searchKey(event: KeyboardEvent, keys: PickerKeys): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    keys.focusCell(0);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    keys.choose(0);
  }
}

/** A key pressed on a cell of the grid. */
function gridKey(event: KeyboardEvent, keys: PickerKeys): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    keys.choose(keys.active);
    return;
  }
  const target = gridTarget(event.key, keys.active, keys.count);
  if (target !== null) {
    event.preventDefault();
    keys.focusCell(target);
  }
}

/** Answer one key pressed anywhere inside the picker. */
function pickerKey(event: KeyboardEvent, keys: PickerKeys): void {
  event.stopPropagation();
  if (event.key === 'Escape') {
    event.preventDefault();
    keys.close();
  } else if (event.target instanceof HTMLInputElement) {
    searchKey(event, keys);
  } else {
    gridKey(event, keys);
  }
}

/** Listen for the keys of {@link box} while it is mounted, with the newest {@link keys}. */
export function useEmojiKeys(box: RefObject<HTMLElement | null>, keys: PickerKeys): void {
  const keysRef = useRef(keys);
  useEffect(() => {
    keysRef.current = keys;
  });
  useEffect(() => {
    const element = box.current;
    const onKeyDown = (event: KeyboardEvent): void => {
      pickerKey(event, keysRef.current);
    };
    element?.addEventListener('keydown', onKeyDown);
    return (): void => {
      element?.removeEventListener('keydown', onKeyDown);
    };
  }, [box]);
}
