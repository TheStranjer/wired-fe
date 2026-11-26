/**
 * The mobile pane switcher (WFE-247, decision 17): `‹ 2/4 ›` in the title bar.
 * The arrows step to the previous and next pane of the desktop exactly as
 * `/focus prev` and `/focus next` do; the counter opens a menu of every pane
 * to jump to. Every button is at least 44 by 44 CSS pixels.
 */
import { useCallback } from 'react';
import type { JSX } from 'react';

import styles from './PaneSwitcher.module.css';
import { useT } from '../i18n/I18nProvider';
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

/** Dispatchers that step to the previous or next pane and jump to a pane. */
function useFocusMoves(): {
  readonly step: (direction: 'next' | 'prev') => void;
  readonly jump: (paneId: string) => void;
} {
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
  return { step, jump };
}

/** The switcher over `entries`, showing the one at `index`. */
export function PaneSwitcher(props: {
  readonly entries: readonly SwitcherEntry[];
  readonly index: number;
}): JSX.Element {
  const { entries, index } = props;
  const { step, jump } = useFocusMoves();
  const t = useT();
  // The visible `2/4` is part of the name, so voice control can say what it sees.
  const count = `${String(index + 1)}/${String(entries.length)}`;
  const items: readonly MenuItem[] = entries.map((entry, at) => ({
    id: entry.paneId,
    label: entry.title,
    checked: at === index,
  }));
  return (
    <span className={styles['switcher']}>
      <Step
        label={t('app.pane_previous')}
        glyph="‹"
        onStep={() => {
          step('prev');
        }}
      />
      <MenuButton
        label={t('app.pane_switch', { count })}
        glyph={count}
        items={items}
        onSelect={jump}
      />
      <Step
        label={t('app.pane_next')}
        glyph="›"
        onStep={() => {
          step('next');
        }}
      />
    </span>
  );
}
