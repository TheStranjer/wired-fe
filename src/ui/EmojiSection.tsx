/**
 * The emoji picker's grid (WFE-265), as headed runs: the heading, a note
 * where the section has nothing yet (`loading…`), and one button per cell. A
 * custom emoji is drawn as its still picture, a Unicode one as its character.
 * Only the grid's active cell is in the tab order; the arrow keys, which the
 * picker listens for, move between the others.
 */
import type { JSX } from 'react';

import styles from './EmojiPicker.module.css';
import type { Cell, Section } from './emojiPickerModel';
import { useT } from '../i18n/I18nProvider';

/** What the sections report, and which cell is the grid's tab stop. */
type GridProps = {
  /** The grid index that is the tab stop. */
  readonly active: number;
  /** Called with the grid index of a cell that took focus. */
  readonly onFocusCell: (index: number) => void;
  /** Called with the cell that was clicked. */
  readonly onPick: (cell: Cell) => void;
};

/** Props of {@link EmojiSections}. */
export type EmojiSectionsProps = GridProps & {
  /** The sections, top to bottom. */
  readonly sections: readonly Section[];
};

/** What a cell shows: its picture, or its character. */
function Face(props: { readonly cell: Cell }): JSX.Element {
  const { cell } = props;
  if (cell.image === null) {
    return <>{cell.glyph}</>;
  }
  return <img alt={cell.name} className={styles['image']} draggable={false} src={cell.image} />;
}

/** A section of the picker. */
function EmojiSection(props: GridProps & { readonly section: Section }): JSX.Element {
  const { section, active, onFocusCell, onPick } = props;
  return (
    <section aria-label={section.title} className={styles['section']}>
      <h3 className={styles['heading']}>{section.title}</h3>
      {section.note === null ? null : <p className={styles['note']}>{section.note}</p>}
      <div className={styles['cells']}>
        {section.cells.map((cell, offset) => (
          <button
            aria-label={cell.name}
            aria-pressed={cell.pressed}
            className={styles['cell']}
            key={cell.key}
            onClick={() => {
              onPick(cell);
            }}
            onFocus={() => {
              onFocusCell(section.start + offset);
            }}
            tabIndex={section.start + offset === active ? 0 : -1}
            title={cell.name}
            type="button"
          >
            <Face cell={cell} />
          </button>
        ))}
      </div>
    </section>
  );
}

/** The scrolling list of sections, or a note when the search found none. */
export function EmojiSections(props: EmojiSectionsProps): JSX.Element {
  const { sections, ...grid } = props;
  const t = useT();
  return (
    <div className={styles['scroll']}>
      {sections.map((section) => (
        <EmojiSection key={section.id} {...grid} section={section} />
      ))}
      {sections.length === 0 ? (
        <p className={styles['note']}>{t('ui.emoji_section.no_matches')}</p>
      ) : null}
    </div>
  );
}
