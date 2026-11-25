/**
 * The state of a {@link MenuButton}: which row is focused (null when closed)
 * and, for a menu with a second level, which row opened it and what that level
 * lists. Choosing a row the caller can drill into swaps the rows for a list
 * that starts with `‹ Back` and keeps focus in the menu, on its first row;
 * Back swaps the top level back with focus on the row that opened it.
 */
import { useCallback, useState } from 'react';

import type { MenuItem } from './menuNav';

/** The id of the row that leaves a second level. */
const BACK_ID = 'back';

/** The first row of every second level. */
const BACK_ITEM: MenuItem = { id: BACK_ID, label: '‹ Back' };

/** A second level that is open: the row that opened it and its rows, Back first. */
type Level = { readonly opener: string; readonly items: readonly MenuItem[] };

/** What the menu button needs from the dropdown's state. */
export type Dropdown = {
  readonly active: number | null;
  readonly setActive: (index: number | null) => void;
  /** The rows on show: the top level's, or the second level's. */
  readonly shown: readonly MenuItem[];
  /** The row that opened the second level, null at the top level. */
  readonly opener: string | null;
  /** Closes the menu, whatever level it is on. */
  readonly dismiss: () => void;
  /** Closes the menu and hands focus back to the button. */
  readonly close: () => void;
  readonly select: (id: string) => void;
};

/** What a dropdown is given: its rows, what a chosen row means, and how to focus its button. */
export type DropdownProps = {
  readonly items: readonly MenuItem[];
  readonly onSelect: (id: string) => void;
  /** Lists the second level a row opens, or null when it opens none. */
  readonly drill: ((id: string) => readonly MenuItem[] | null) | undefined;
  /** Hands focus back to the button. */
  readonly focusButton: () => void;
};

/** The state of a dropdown over {@link DropdownProps}. */
export function useDropdown(props: DropdownProps): Dropdown {
  const { items, onSelect, drill, focusButton } = props;
  const [active, setActive] = useState<number | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const dismiss = useCallback(() => {
    setActive(null);
    setLevel(null);
  }, []);
  const close = (): void => {
    dismiss();
    focusButton();
  };
  const select = (id: string): void => {
    const sub = drill?.(id) ?? null;
    if (level !== null && id === BACK_ID) {
      setActive(items.findIndex((item) => item.id === level.opener));
      setLevel(null);
    } else if (sub === null) {
      onSelect(id);
      close();
    } else {
      setLevel({ opener: id, items: [BACK_ITEM, ...sub] });
      setActive(0);
    }
  };
  return {
    active,
    setActive,
    shown: level === null ? items : level.items,
    opener: level === null ? null : level.opener,
    dismiss,
    close,
    select,
  };
}
