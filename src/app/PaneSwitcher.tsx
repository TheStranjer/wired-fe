/**
 * The mobile pane switcher (WFE-247, decision 17): `‹ 2/4 ›` in the title bar.
 * The arrows step to the previous and next pane of the desktop exactly as
 * `/focus prev` and `/focus next` do; the counter opens a menu of every pane
 * to jump to. Every button is at least 44 by 44 CSS pixels.
 */
import { useCallback } from 'react';
import type { JSX } from 'react';

import styles from './PaneSwitcher.module.css';
import { useAppDispatch } from '../state/StateContext';
import { MenuButton } from '../ui/MenuButton';
import type { MenuItem } from '../ui/MenuButton';

/** One pane of the cycle: its id and the title of its window. */
export type SwitcherEntry = { readonly paneId: string; readonly title: string };

/** One arrow button of the switcher. */
function Step(props: {
  readonly label: string;
  readonly glyph: string;
  readonly onStep: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className={styles['step']}
      aria-label={props.label}
      onClick={props.onStep}
    >
      {props.glyph}
    </button>
  );
}

/** The switcher over `entries`, showing the one at `index`. */
export function PaneSwitcher(props: {
  readonly entries: readonly SwitcherEntry[];
  readonly index: number;
}): JSX.Element {
  const { entries, index } = props;
  const dispatch = useAppDispatch();
  const step = useCallback(
    (direction: 'next' | 'prev') => {
      dispatch({ type: 'layout', action: { type: 'focusStep', step: direction } });
    },
    [dispatch],
  );
  const jump = useCallback(
    (paneId: string) => {
      dispatch({ type: 'layout', action: { type: 'focusPane', paneId } });
    },
    [dispatch],
  );
  const items: readonly MenuItem[] = entries.map((entry, at) => ({
    id: entry.paneId,
    label: entry.title,
    checked: at === index,
  }));
  return (
    <span className={styles['switcher']}>
      <Step
        label="Previous pane"
        glyph="‹"
        onStep={() => {
          step('prev');
        }}
      />
      <MenuButton
        label="Switch pane"
        glyph={`${String(index + 1)}/${String(entries.length)}`}
        items={items}
        onSelect={jump}
      />
      <Step
        label="Next pane"
        glyph="›"
        onStep={() => {
          step('next');
        }}
      />
    </span>
  );
}
