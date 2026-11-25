/**
 * The top line of a post card (decision 15): the label `[a3]` on the left, the
 * clock on the right and, between them, the account a multi-account feed's
 * item came through (WFE-226). A direct message carries a strip between them,
 * `✉ DM  alice → you, bob`, so it reads as a DM without relying on colour
 * alone (WFE-234). Purely presentational.
 */
import type { JSX } from 'react';

import styles from './CardHead.module.css';
import { Timestamp } from './Timestamp';
import { type Via, ViaMark } from './ViaMark';
import type { ClockFormat } from '../lib/time';

/** Who a direct message is between: the sender and the others it names. */
export type DmStrip = {
  readonly from: string;
  readonly to: readonly string[];
};

/** Props of {@link CardHead}. */
export type CardHeadProps = {
  readonly label: string;
  readonly date: Date;
  readonly clockFormat: ClockFormat;
  readonly selected: boolean;
  /** The sender and recipients of a direct message; null for any other post. */
  readonly dm: DmStrip | null;
  /** The account the item came through; null when the window marks none. */
  readonly via: Via | null;
};

/** The strip's words: `✉ DM  alice → you, bob`, or just the sender when nobody else is named. */
function stripText(dm: DmStrip): string {
  const people = dm.to.length === 0 ? dm.from : `${dm.from} → ${dm.to.join(', ')}`;
  return `✉ DM  ${people}`;
}

/** The label, the DM strip and the account marker when there are any, and the clock. */
export function CardHead(props: CardHeadProps): JSX.Element {
  const { label, date, clockFormat, selected, dm, via } = props;
  const labelClass = [styles['label'], selected ? styles['labelSelected'] : ''].join(' ');
  return (
    <div className={styles['head']}>
      <span className={labelClass}>{`[${label}]`}</span>
      {dm === null ? undefined : <span className={styles['dm']}>{stripText(dm)}</span>}
      {via === null ? undefined : <ViaMark via={via} form="card" />}
      <Timestamp date={date} format={clockFormat} />
    </div>
  );
}
