/**
 * The open list of a {@link MenuButton}: a `role="menu"` of buttons, one per
 * item, with the focused item the only one in the tab order. Focus follows
 * `active`; the keys and the open state belong to the button that renders it.
 */
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';

import styles from './MenuButton.module.css';
import { onMenuKey } from './menuKeys';
import type { MenuControls } from './menuKeys';

/** What the list shows and reports. */
export type MenuListProps = {
  /** Accessible name of the menu. */
  readonly label: string;
  /** Element id the button's `aria-controls` points at. */
  readonly id: string;
  /** The rows, and what keys and clicks on them ask for. */
  readonly controls: MenuControls;
  /** The focused row, -1 when none can be. */
  readonly active: number;
};

/** The marker drawn before a checkbox row: ticked or not. */
function Mark(props: { readonly checked: boolean | undefined }): JSX.Element | null {
  if (props.checked === undefined) {
    return null;
  }
  return <span aria-hidden="true">{props.checked ? '[x] ' : '[ ] '}</span>;
}

/** The menu: one `menuitem` (or `menuitemcheckbox`) button per item. */
export function MenuList(props: MenuListProps): JSX.Element {
  const { controls, active } = props;
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const row = menuRef.current?.children.item(active) ?? menuRef.current;
    if (row instanceof HTMLElement) {
      row.focus();
    }
  }, [active]);

  return (
    <div
      aria-label={props.label}
      className={styles['menu']}
      id={props.id}
      onKeyDown={(event) => {
        onMenuKey(event, controls, active);
      }}
      ref={menuRef}
      role="menu"
      tabIndex={-1}
    >
      {controls.items.map((item, index) => (
        <button
          aria-checked={item.checked}
          className={styles['item']}
          disabled={item.disabled === true}
          key={item.id}
          onClick={() => {
            controls.select(item.id);
          }}
          role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
          tabIndex={index === active ? 0 : -1}
          type="button"
        >
          <Mark checked={item.checked} />
          {item.label}
        </button>
      ))}
    </div>
  );
}
