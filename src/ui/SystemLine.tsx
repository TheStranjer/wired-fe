/**
 * A client message in the scrollback, IRC style: the clock, a `***` marker
 * and the text, e.g. command output, a warning or an error. The text is
 * always plain text, never HTML. Purely presentational.
 */
import type { JSX } from 'react';

import styles from './SystemLine.module.css';
import { Timestamp } from './Timestamp';
import type { ClockFormat } from '../lib/time';

/** Props of {@link SystemLine}. */
export type SystemLineProps = {
  /** The moment the message was produced, shown by {@link Timestamp}. */
  readonly date: Date;
  /** How the clock is rendered. */
  readonly clockFormat: ClockFormat;
  /** Severity: colours the text and adds the screen-reader prefix. */
  readonly level: 'info' | 'warn' | 'error';
  /** The message itself, rendered as plain text. */
  readonly text: string;
};

/** The text span's colour class per level. */
const LEVEL_CLASS: Record<SystemLineProps['level'], string | undefined> = {
  info: styles['info'],
  warn: styles['warn'],
  error: styles['error'],
};

/** What assistive technology hears before the text; none for plain info. */
const SR_PREFIX: Record<SystemLineProps['level'], string | undefined> = {
  info: undefined,
  warn: 'Warning: ',
  error: 'Error: ',
};

/** One scrollback line of client output: `23:04 *** text`. */
export function SystemLine(props: SystemLineProps): JSX.Element {
  const { date, clockFormat, level, text } = props;
  const prefix = SR_PREFIX[level];

  return (
    <div className={styles['line']}>
      <Timestamp date={date} format={clockFormat} />{' '}
      <span aria-hidden="true" className={styles['marker']}>
        ***
      </span>{' '}
      <span className={LEVEL_CLASS[level]}>
        {prefix === undefined ? undefined : (
          <span className={styles['visuallyHidden']}>{prefix}</span>
        )}
        {text}
      </span>
    </div>
  );
}
