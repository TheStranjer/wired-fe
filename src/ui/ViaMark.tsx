/**
 * The dim marker of which account a feed item came through (decision 14,
 * WFE-226): `→ @me` on a card, `→me` on an IRC line. Shown only in a feed whose
 * sources span several accounts, because actions on the item act as that
 * account. Purely presentational: the view layer hands it the plain data.
 */
import type { JSX } from 'react';

import styles from './ViaMark.module.css';
import { useT } from '../i18n/I18nProvider';

/** The account marker as data: the short text shown, and every account in full. */
export type Via = {
  /** The shown handle without its `@` — the local part when unambiguous, else
   * the whole handle — plus ` +N` when several accounts saw the item. */
  readonly label: string;
  /** Every account that saw the item, as `@user@host`, comma separated. */
  readonly full: string;
};

/** Props of {@link ViaMark}: the marker, and how its arrow is spaced. */
export type ViaMarkProps = {
  readonly via: Via;
  /** `card` writes `→ @me`, `line` writes `→me`. */
  readonly form: 'card' | 'line';
};

/** The marker; its accessible name and title carry the full account list. */
export function ViaMark(props: ViaMarkProps): JSX.Element {
  const { via, form } = props;
  const t = useT();
  const text = form === 'card' ? `→ @${via.label}` : `→${via.label}`;
  return (
    <span
      aria-label={t('ui.via_mark.label', { accounts: via.full })}
      className={form === 'card' ? styles['card'] : styles['line']}
      role="note"
      title={via.full}
    >
      {text}
    </span>
  );
}
