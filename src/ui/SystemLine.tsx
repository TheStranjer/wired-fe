/**
 * A client message in the scrollback, IRC style: the clock, a `***` marker
 * and the text, e.g. command output, a warning or an error. The text is
 * always plain text, never HTML. A message that speaks about an account can
 * lead with that account's handle as a click target (WFE-106), which the
 * text then must not repeat. A decorative message (WFE-135, the startup
 * banner's ASCII art) is hidden from assistive technology and never wrapped,
 * so its block letters keep their shape. Purely presentational.
 */
import type { JSX } from 'react';

import { onMiddleClick } from './middleClick';
import styles from './SystemLine.module.css';
import { Timestamp } from './Timestamp';
import { type Via, ViaMark } from './ViaMark';
import type { ClickModifiers } from '../lib/clickModifiers';
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
  /** The account the message is about: its `@handle` leads {@link text} as a
   * button, e.g. to open the account's profile. Omitted for plain messages. */
  readonly actor?:
    { readonly handle: string; readonly onSelect: (click: ClickModifiers) => void } | undefined;
  /** The text is decorative ASCII art (WFE-135): the whole line is hidden from
   * assistive technology and rendered unwrapped, so the art keeps its shape. */
  readonly decorative?: boolean | undefined;
  /** The account a multi-account feed's notification came through (WFE-226),
   * drawn dim after the clock. Omitted or null for every other message. */
  readonly via?: Via | null | undefined;
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
  const { date, clockFormat, level, text, actor, decorative, via } = props;
  const prefix = SR_PREFIX[level];

  return (
    <div
      className={decorative === true ? styles['decorative'] : styles['line']}
      aria-hidden={decorative}
    >
      <Timestamp date={date} format={clockFormat} />{' '}
      {via === null || via === undefined ? undefined : (
        <>
          <ViaMark via={via} form="line" />{' '}
        </>
      )}
      <span aria-hidden="true" className={styles['marker']}>
        ***
      </span>{' '}
      <span className={LEVEL_CLASS[level]}>
        {prefix === undefined ? undefined : (
          <span className={styles['visuallyHidden']}>{prefix}</span>
        )}
        {actor === undefined ? undefined : (
          <>
            <button
              type="button"
              className={styles['actor']}
              onAuxClick={onMiddleClick(actor.onSelect)}
              onClick={actor.onSelect}
            >
              {actor.handle}
            </button>{' '}
          </>
        )}
        {text}
      </span>
    </div>
  );
}
