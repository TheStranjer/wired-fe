/**
 * The `☺` button of a card's action bar (WFE-265). Where the registry's react
 * line says it opens the picker, a click opens the emoji picker under the
 * button; where it does not (a line that only fills the command line), a click
 * hands the line on like any other button. Closing the picker — Escape, a
 * choice or a click outside — returns focus to the button, as
 * {@link MenuButton} does.
 */
import { useCallback, useRef, useState } from 'react';
import type { JSX, RefObject } from 'react';

import { EmojiPicker } from './EmojiPicker';
import styles from './PostActions.module.css';
import type { PostActionLine, ReactPicker } from './postActionTypes';
import type { PostReaction } from './ReactionChip';
import { useOutsideDismiss } from './useOutsideDismiss';
import { useT } from '../i18n/I18nProvider';

/** Props of {@link ReactButton}. */
export type ReactButtonProps = {
  /** The post's short label, e.g. "a4". */
  readonly label: string;
  /** The line the registry gives `/react` on this post; none, no button. */
  readonly line: PostActionLine | undefined;
  /** The post's current reactions. */
  readonly reactions: readonly PostReaction[];
  /** The picker's emoji and what its choices do. */
  readonly picker: ReactPicker;
  /** Called with the line when the click is not for the picker. */
  readonly onAction: (line: PostActionLine) => void;
};

/** The open state of a popover under a button, and the ways out of it. */
function usePopover(): {
  readonly open: boolean;
  readonly toggle: () => void;
  readonly close: () => void;
  readonly buttonRef: RefObject<HTMLButtonElement | null>;
  readonly rootRef: RefObject<HTMLDivElement | null>;
} {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dismiss = useCallback(() => {
    setOpen(false);
  }, []);
  const rootRef = useOutsideDismiss(open, dismiss);
  const toggle = (): void => {
    setOpen(!open);
  };
  const close = (): void => {
    dismiss();
    buttonRef.current?.focus();
  };
  return { open, toggle, close, buttonRef, rootRef };
}

/** The react button and the picker it opens, or nothing while `/react` has no line. */
export function ReactButton(props: ReactButtonProps): JSX.Element | null {
  const { label, line, reactions, picker, onAction } = props;
  const { open, toggle, close, buttonRef, rootRef } = usePopover();
  const t = useT();
  if (line === undefined) {
    return null;
  }
  const opens = line.picker === true;

  return (
    <div className={styles['root']} ref={rootRef}>
      <button
        aria-expanded={opens ? open : undefined}
        aria-haspopup={opens ? 'dialog' : undefined}
        aria-label={t('ui.react_button.label', { label })}
        className={styles['button']}
        onClick={() => {
          if (opens) {
            picker.onOpen();
            toggle();
          } else {
            onAction(line);
          }
        }}
        ref={buttonRef}
        type="button"
      >
        ☺
      </button>
      {open ? (
        <EmojiPicker
          data={picker.data}
          label={label}
          onChoose={(emoji, remove) => {
            picker.onChoose(emoji, remove);
            close();
          }}
          onClose={close}
          reactions={reactions}
        />
      ) : null}
    </div>
  );
}
