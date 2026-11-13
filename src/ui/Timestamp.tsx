/**
 * The clock time that prefixes every scrollback line, IRC style. Purely
 * presentational: it formats a given date and owns no state.
 */
import type { JSX } from 'react';

import styles from './Timestamp.module.css';
import { formatClock } from '../lib/time';
import type { ClockFormat } from '../lib/time';

/** The moment to show and the {@link ClockFormat} to render it in. */
export type TimestampProps = { readonly date: Date; readonly format: ClockFormat };

/** A semantic `<time>` element holding the local clock time, dimmed. */
export function Timestamp(props: TimestampProps): JSX.Element {
  return (
    <time dateTime={props.date.toISOString()} className={styles['clock']}>
      {formatClock(props.date, props.format)}
    </time>
  );
}
