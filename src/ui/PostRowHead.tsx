/**
 * The start of a post's IRC line: the label, the clock, the account a
 * multi-account feed's item came through (WFE-226), the nick and who the post
 * answers, e.g. `[a3] 23:04 →me <alice> ↳ re @carol: `. Purely presentational.
 */
import type { JSX } from 'react';

import { Nick } from './Nick';
import styles from './PostRow.module.css';
import { Timestamp } from './Timestamp';
import { type Via, ViaMark } from './ViaMark';
import { useT } from '../i18n/I18nProvider';
import type { ClickModifiers } from '../lib/clickModifiers';
import type { ClockFormat } from '../lib/time';

/** Props of {@link PostRowHead}: the row's own props that its first words draw. */
export type PostRowHeadProps = {
  readonly label: string;
  readonly date: Date;
  readonly clockFormat: ClockFormat;
  readonly via: Via | null;
  readonly author: {
    readonly handle: string;
    readonly fullHandle: string;
    readonly self: boolean;
  };
  readonly replyTo: string | null;
  readonly onSelectAuthor: (click: ClickModifiers) => void;
};

/** The label, clock, account marker, nick and reply marker of a row. */
export function PostRowHead(props: PostRowHeadProps): JSX.Element {
  const { label, date, clockFormat, via, author, replyTo, onSelectAuthor } = props;
  const t = useT();
  return (
    <>
      <span className={styles['label']}>{`[${label}]`}</span>{' '}
      <Timestamp date={date} format={clockFormat} />{' '}
      {via === null ? undefined : (
        <>
          <ViaMark via={via} form="line" />{' '}
        </>
      )}
      <Nick
        handle={author.handle}
        fullHandle={author.fullHandle}
        self={author.self}
        onSelect={onSelectAuthor}
      />{' '}
      {replyTo === null ? undefined : (
        <span className={styles['reply']}>
          {`${t('ui.post_row_head.reply_to', { label: replyTo })} `}
        </span>
      )}
    </>
  );
}
