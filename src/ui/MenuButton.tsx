/**
 * A button that opens a dropdown menu (WFE-190), following the WAI-ARIA menu
 * button pattern: the button has `aria-haspopup="menu"` and `aria-expanded`;
 * a click, Enter, Space or ArrowDown opens the menu on its first enabled item
 * and ArrowUp on its last. Inside, the arrows move with wrap, Home/End jump,
 * a typed letter jumps to the next label starting with it, Enter, Space or a
 * click select, and Escape, Tab or a click outside close. Closing by keyboard
 * returns focus to the button. A row the caller can `drill` into swaps the
 * rows for a second level (`‹ Back` first, focus on it) instead of closing
 * (WFE-270). Presentational: it owns only whether it is open and which row is
 * focused; what a selection means is the caller's.
 */
import { useId, useRef } from 'react';
import type { JSX } from 'react';

import styles from './MenuButton.module.css';
import { onButtonKey } from './menuKeys';
import { MenuList } from './MenuList';
import { firstEnabled } from './menuNav';
import type { MenuItem } from './menuNav';
import { useDropdown } from './useDropdown';
import type { Dropdown } from './useDropdown';
import { useOutsideDismiss } from './useOutsideDismiss';

export type { MenuItem } from './menuNav';

/** What the button shows and what its menu offers. */
export type MenuButtonProps = {
  /** Accessible name of the button and of the menu, e.g. `Split side by side`. */
  readonly label: string;
  /** The tooltip of the button, e.g. what it does, its command and keys (WFE-312); none when absent. */
  readonly title?: string;
  /** The visible text of the button, e.g. `◫▾`. */
  readonly glyph: string;
  /** The menu's rows, top to bottom. */
  readonly items: readonly MenuItem[];
  /** Called with the chosen row's id; the menu closes right after. */
  readonly onSelect: (id: string) => void;
  /** The rows of the second level that row `id` opens, or null when it opens none. */
  readonly drill?: (id: string) => readonly MenuItem[] | null;
};

/** The open list of the dropdown `menu`, remounted (and so refocused) when its level changes. */
function OpenMenu(props: {
  readonly active: number;
  readonly id: string;
  readonly label: string;
  readonly menu: Dropdown;
}): JSX.Element {
  const { active, id, label, menu } = props;
  const controls = {
    items: menu.shown,
    setActive: menu.setActive,
    close: menu.close,
    select: menu.select,
  };
  return (
    <MenuList active={active} controls={controls} id={id} key={menu.opener ?? ''} label={label} />
  );
}

/** A button that opens a dropdown menu of `items`. */
export function MenuButton(props: MenuButtonProps): JSX.Element {
  const { label, title, glyph, items, onSelect, drill } = props;
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const focusButton = (): void => {
    buttonRef.current?.focus();
  };
  const menu = useDropdown({ items, onSelect, drill, focusButton });
  const { active } = menu;
  const rootRef = useOutsideDismiss(active !== null, menu.dismiss);
  const menuId = useId();

  return (
    <div className={styles['root']} ref={rootRef}>
      <button
        aria-controls={active === null ? undefined : menuId}
        aria-expanded={active !== null}
        aria-haspopup="menu"
        aria-label={label}
        className={styles['button']}
        onClick={() => {
          if (active === null) {
            menu.setActive(firstEnabled(items));
          } else {
            menu.dismiss();
          }
          focusButton();
        }}
        onKeyDown={(event) => {
          onButtonKey(event, items, menu.setActive);
        }}
        ref={buttonRef}
        title={title}
        type="button"
      >
        {glyph}
      </button>
      {active === null ? null : <OpenMenu active={active} id={menuId} label={label} menu={menu} />}
    </div>
  );
}
