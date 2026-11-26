/**
 * An IRC whois block (WFE-106): the account header a profile window shows
 * above its scrollback, one `***` line per piece of the whois answer — the
 * account's name and handle, its bio, one line per profile field, the
 * counters and join date, and the relationships that actually hold between
 * viewer and account. Purely presentational (AGENTS.md "Layout"): the
 * feature's loader maps the API entities onto these plain props; the bio and
 * field values are hostile remote HTML and render only through
 * {@link RemoteHtml} (decision 10).
 */
import type { JSX, ReactNode } from 'react';

import { RemoteHtml } from './RemoteHtml';
import styles from './WhoisBlock.module.css';
import { formatDay } from '../i18n/format';
import { useLocale, useT } from '../i18n/I18nProvider';
import type { MessageKey, Translate } from '../i18n/messages';

/** One profile metadata row, as the whois block shows it. */
type WhoisField = {
  /** The field's own label, e.g. "site". */
  readonly name: string;
  /** The value as hostile remote HTML; {@link RemoteHtml} sanitizes it. */
  readonly valueHtml: string;
  /** Whether the backend verified the value's link. */
  readonly verified: boolean;
};

/** WhoisBlock's props: one account as the viewer sees it, in plain data. */
export type WhoisBlockProps = {
  /** The account's display name, or its username when it has none. */
  readonly displayName: string;
  /** The full `user@host` handle, without its leading `@`. */
  readonly handle: string;
  /** The bio as hostile remote HTML; '' shows no bio line at all. */
  readonly bioHtml: string;
  /** The profile metadata rows, in the order the server sent them. */
  readonly fields: readonly WhoisField[];
  /** The counters the backend reports for the account. */
  readonly counts: {
    readonly posts: number;
    readonly following: number;
    readonly followers: number;
  };
  /** The moment the account joined; the block shows its day as digits in the language in use. */
  readonly joined: Date;
  /** Which relationships between viewer and account actually hold. */
  readonly relationships: {
    readonly following: boolean;
    readonly followedBy: boolean;
    readonly blocked: boolean;
    readonly muted: boolean;
  };
};

/** The relationships in speaking order, each with the words it speaks. */
const RELATIONSHIPS: readonly [keyof WhoisBlockProps['relationships'], MessageKey][] = [
  ['following', 'ui.whois_block.following'],
  ['followedBy', 'ui.whois_block.followed_by'],
  ['blocked', 'ui.whois_block.blocked'],
  ['muted', 'ui.whois_block.muted'],
];

/** The words of the relationships that hold, in that order; empty if none. */
function relationshipWords(t: Translate, rel: WhoisBlockProps['relationships']): readonly string[] {
  return RELATIONSHIPS.filter(([flag]) => rel[flag]).map(([, key]) => t(key));
}

/** One `***` line of the block; detail lines indent past the marker. */
function WhoisLine(props: {
  readonly indent?: boolean;
  readonly children: ReactNode;
}): JSX.Element {
  const { indent = false, children } = props;
  return (
    <div className={styles['line']}>
      <span aria-hidden="true" className={styles['marker']}>
        ***
      </span>
      {indent ? '   ' : ' '}
      {children}
    </div>
  );
}

/** One profile metadata row: its name, its sanitized value, and its mark. */
function FieldLine(props: { readonly field: WhoisField }): JSX.Element {
  const { field } = props;
  const t = useT();
  return (
    <WhoisLine indent>
      {`${field.name}: `}
      <RemoteHtml html={field.valueHtml} inline />
      {field.verified ? (
        <span className={styles['verified']} title={t('ui.whois_block.verified_title')}>
          <span className={styles['visuallyHidden']}>{t('ui.whois_block.verified')}</span>
          <span aria-hidden="true"> ✓</span>
        </span>
      ) : undefined}
    </WhoisLine>
  );
}

/** The account header of a profile window, IRC whois style. */
export function WhoisBlock(props: WhoisBlockProps): JSX.Element {
  const { displayName, handle, bioHtml, fields, counts, joined, relationships } = props;
  const locale = useLocale();
  const t = useT();
  const words = relationshipWords(t, relationships);
  return (
    <div className={styles['block']}>
      <WhoisLine>{`${displayName} (@${handle})`}</WhoisLine>
      {bioHtml === '' ? undefined : (
        <WhoisLine indent>
          <RemoteHtml html={bioHtml} inline />
        </WhoisLine>
      )}
      {fields.map((field, index) => (
        <FieldLine field={field} key={`${field.name}-${String(index)}`} />
      ))}
      <WhoisLine indent>
        {t('format.whois_counts', { ...counts, joined: formatDay(locale, joined) })}
      </WhoisLine>
      {words.length === 0 ? undefined : <WhoisLine indent>{words.join(' · ')}</WhoisLine>}
    </div>
  );
}
