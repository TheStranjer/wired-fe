/**
 * The emoji picker (WFE-265): a popover under a card's `☺` button, a
 * `role="dialog"` named `React to [a4]`. A search field takes focus when it
 * opens and filters every section by name, shortcode or keyword; under it come
 * the post's own reactions (pressed where the viewer's is on), the instance's
 * custom emoji by category and all the Unicode emoji by group, with a dim
 * `loading…` until those have arrived. The keys are in ./emojiPickerKeys; where
 * it opens (under, or above when there is no room) is ./useFlipAbove. Purely
 * presentational: it reports the chosen emoji and whether that takes the
 * viewer's reaction back, and asks to be closed; what either means is the
 * caller's.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, RefObject } from 'react';

import styles from './EmojiPicker.module.css';
import { useEmojiKeys } from './emojiPickerKeys';
import { pickerSections } from './emojiPickerModel';
import type { Cell, PickerData } from './emojiPickerModel';
import { EmojiSections } from './EmojiSection';
import type { PostReaction } from './ReactionChip';
import { useFlipAbove } from './useFlipAbove';
import { useT } from '../i18n/I18nProvider';

/** Props of {@link EmojiPicker}. */
export type EmojiPickerProps = {
  /** The post's short label, e.g. "a4"; it names the dialog. */
  readonly label: string;
  /** The post's current reactions. */
  readonly reactions: readonly PostReaction[];
  /** The custom and Unicode emoji to offer. */
  readonly data: PickerData;
  /** Called with the chosen emoji, and true when choosing it takes the viewer's reaction back. */
  readonly onChoose: (emoji: string, remove: boolean) => void;
  /** Called when the picker asks to be closed (Escape). */
  readonly onClose: () => void;
};

/** Move focus to the cell at {@link index} of the {@link box}, or to {@link search} above the first. */
function focusCell(
  box: RefObject<HTMLElement | null>,
  search: RefObject<HTMLElement | null>,
  index: number,
): void {
  const target = index < 0 ? search.current : box.current?.querySelectorAll('button').item(index);
  target?.focus();
}

/** The search field above the grid; it takes focus as the picker opens. */
function SearchField(props: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly inputRef: RefObject<HTMLInputElement | null>;
}): JSX.Element {
  const t = useT();
  const { inputRef } = props;
  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);
  return (
    <input
      aria-label={t('ui.emoji_picker.search_label')}
      className={styles['search']}
      onChange={(event) => {
        props.onChange(event.target.value);
      }}
      placeholder={t('ui.emoji_picker.search_placeholder')}
      ref={inputRef}
      type="search"
      value={props.value}
    />
  );
}

/** The emoji picker of the post labelled {@link EmojiPickerProps.label}. */
export function EmojiPicker(props: EmojiPickerProps): JSX.Element {
  const { label, reactions, data, onChoose, onClose } = props;
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const t = useT();
  const sections = useMemo(
    () => pickerSections({ ...data, reactions }, query, t),
    [data, reactions, query, t],
  );
  const cells = sections.flatMap((section) => section.cells);
  const pick = (cell: Cell | undefined): void => {
    if (cell !== undefined) {
      onChoose(cell.choose, cell.remove);
    }
  };
  useFlipAbove(boxRef);
  useEmojiKeys(boxRef, {
    count: cells.length,
    active,
    close: onClose,
    choose: (index) => {
      pick(cells[index]);
    },
    focusCell: (index) => {
      focusCell(boxRef, searchRef, index);
    },
  });

  return (
    <div
      aria-label={t('ui.emoji_picker.dialog', { label })}
      className={styles['popup']}
      ref={boxRef}
      role="dialog"
    >
      <SearchField
        inputRef={searchRef}
        onChange={(text) => {
          setQuery(text);
          setActive(0);
        }}
        value={query}
      />
      <EmojiSections active={active} onFocusCell={setActive} onPick={pick} sections={sections} />
    </div>
  );
}
