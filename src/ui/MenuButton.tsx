/**
 * A button that opens a dropdown menu (WFE-190), following the WAI-ARIA menu
 * button pattern: the button has `aria-haspopup="menu"` and `aria-expanded`;
 * a click, Enter, Space or ArrowDown opens the menu on its first enabled item
 * and ArrowUp on its last. Inside, the arrows move with wrap, Home/End jump,
 * a typed letter jumps to the next label starting with it, Enter, Space or a
 * click select, and Escape, Tab or a click outside close. Closing by keyboard
 * returns focus to the button. Presentational: it owns only whether it is
 * open and which row is focused; what a selection means is the caller's.
 */
import { useCallback, useId, useRef, useState } from 'react';
import type { JSX } from 'react';

import styles from './MenuButton.module.css';
import { onButtonKey } from './menuKeys';
import { MenuList } from './MenuList';
import { firstEnabled } from './menuNav';
import type { MenuItem } from './menuNav';
import { useOutsideDismiss } from './useOutsideDismiss';

export type { MenuItem } from './menuNav';

/** What the button shows and what its menu offers. */
export type MenuButtonProps = {
  /** Accessible name of the button and of the menu, e.g. `Split side by side`. */
  readonly label: string;
  /** The visible text of the button, e.g. `┃▾`. */
  readonly glyph: string;
  /** The menu's rows, top to bottom. */
  readonly items: readonly MenuItem[];
  /** Called with the chosen row's id; the menu closes right after. */
  readonly onSelect: (id: string) => void;
};

/** A button that opens a dropdown menu of `items`. */
export function MenuButton(props: MenuButtonProps): JSX.Element {
  const { label, glyph, items, onSelect } = props;
  const [active, setActive] = useState<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();
  const dismiss = useCallback(() => {
    setActive(null);
  }, []);
  const rootRef = useOutsideDismiss(active !== null, dismiss);
  const close = (): void => {
    dismiss();
    buttonRef.current?.focus();
  };
  const select = (id: string): void => {
    onSelect(id);
    close();
  };

  return (
    <div className={styles['root']} ref={rootRef}>
      <button
        aria-controls={active === null ? undefined : menuId}
        aria-expanded={active !== null}
        aria-haspopup="menu"
        aria-label={label}
        className={styles['button']}
        onClick={() => {
          setActive(active === null ? firstEnabled(items) : null);
          buttonRef.current?.focus();
        }}
        onKeyDown={(event) => {
          onButtonKey(event, items, setActive);
        }}
        ref={buttonRef}
        type="button"
      >
        {glyph}
      </button>
      {active === null ? null : (
        <MenuList
          active={active}
          controls={{ items, setActive, close, select }}
          id={menuId}
          label={label}
        />
      )}
    </div>
  );
}
