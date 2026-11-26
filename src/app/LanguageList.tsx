/**
 * The list of interface languages (WFE-310, decisions 6 and 19): one button
 * per supported language with its own name and its English name beside it, so
 * a reader can find theirs whatever the current language is, and a last row
 * that clears the choice. A row runs `/lang <code>` (or `/lang auto`) through
 * the same command line as everything else. Like the view list it takes one
 * tab stop; the arrows, Home, End and a typed letter move between rows.
 */
import { useRef, useState } from 'react';
import type { JSX } from 'react';

import styles from './LanguageList.module.css';
import { AUTO_WORD } from '../commands/languageWords';
import { useT } from '../i18n/I18nProvider';
import { SUPPORTED_LOCALES } from '../i18n/supportedLocales';
import { type MenuItem, navTarget } from '../ui/menuNav';
import type { PostActionLine } from '../ui/postActionTypes';

/** One row: the command argument it runs, the text the keys jump by, and what it shows. */
type Row = MenuItem & { readonly word: string; readonly note: string };

/** The rows: every language, then the one that clears the choice. */
function rowsOf(automatic: string): readonly Row[] {
  const languages = SUPPORTED_LOCALES.map((one) => ({
    id: one.code,
    word: one.code,
    label: one.native,
    note: one.english,
  }));
  return [...languages, { id: AUTO_WORD, word: AUTO_WORD, label: automatic, note: '' }];
}

/** The language list: {@link run} gets the line of the row chosen. */
export function LanguageList(props: { readonly run: (line: PostActionLine) => void }): JSX.Element {
  const t = useT();
  const rows = rowsOf(t('app.language_auto'));
  const listRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  return (
    <div
      aria-label={t('app.language_list_label')}
      aria-orientation="vertical"
      className={styles['list']}
      onKeyDown={(event) => {
        const target = navTarget(rows, active, event);
        if (target !== null) {
          event.preventDefault();
          listRef.current?.querySelectorAll('button')[target]?.focus();
        }
      }}
      ref={listRef}
      role="toolbar"
    >
      {rows.map((row, index) => (
        <button
          className={styles['row']}
          key={row.id}
          onClick={() => {
            props.run({ line: `/lang ${row.word}`, prefill: false });
          }}
          onFocus={() => {
            setActive(index);
          }}
          tabIndex={index === active ? 0 : -1}
          type="button"
        >
          <span lang={row.id === AUTO_WORD ? undefined : row.id}>{row.label}</span>{' '}
          <span className={styles['english']}>{row.note}</span>
        </button>
      ))}
    </div>
  );
}
