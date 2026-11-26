/**
 * The feed editor's table of sources (decision 14): one row per signed-in
 * account, one column per kind of source, each cell a checkbox named for what
 * it ticks — "home of @me@w.example". A source the account cannot be read
 * from is disabled and its name says why, but one the feed already reads can
 * always be unticked.
 */

import type { JSX } from 'react';

import { blockedReason } from './blockedReason';
import { type EditorDraft, hasSource } from './editorDraft';
import styles from './FeedEditor.module.css';
import type { StoredAccount } from '../../accounts/accountStore';
import { useT } from '../../i18n/I18nProvider';
import { type FeedSource, type FeedSourceRef, PLAIN_SOURCES } from '../../state/feeds';

/** What the table shows and the one thing it does. */
type SourceTableProps = {
  readonly accounts: readonly StoredAccount[];
  /** Keys of the accounts whose sign-in lapsed. */
  readonly expired: ReadonlySet<string>;
  readonly draft: EditorDraft;
  readonly onToggle: (ref: FeedSourceRef) => void;
};

/** The accessible name of the checkbox of {@link source} as {@link account}, with the reason it is disabled. */
function cellName(
  t: ReturnType<typeof useT>,
  cell: {
    readonly source: FeedSource;
    readonly account: StoredAccount;
    readonly reason: string | null;
  },
): string {
  const { source, account, reason } = cell;
  const values = { source, handle: account.handle };
  return reason === null
    ? t('features.feed_editor.cell_name', values)
    : t('features.feed_editor.cell_name_blocked', { ...values, reason });
}

/** One checkbox: {@link source} read as {@link account}. */
function SourceCell(
  props: Omit<SourceTableProps, 'accounts'> & {
    readonly account: StoredAccount;
    readonly source: FeedSource;
  },
): JSX.Element {
  const { account, source, draft, expired } = props;
  const t = useT();
  const ref: FeedSourceRef = { accountKey: account.key, source };
  const checked = hasSource(draft, ref);
  const reason = blockedReason(account.key, expired);
  return (
    <td className={styles['cell']}>
      <input
        type="checkbox"
        aria-label={cellName(t, { source, account, reason })}
        checked={checked}
        disabled={reason !== null && !checked}
        onChange={() => {
          props.onToggle(ref);
        }}
      />
    </td>
  );
}

/** The table of every signed-in account by every plain source. */
export function SourceTable(props: SourceTableProps): JSX.Element {
  const t = useT();
  return (
    <table className={styles['table']} aria-label={t('features.feed_editor.sources_label')}>
      <thead>
        <tr>
          <th scope="col">{t('features.feed_editor.column_account')}</th>
          {PLAIN_SOURCES.map((source) => (
            <th key={source} scope="col">
              {source}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {props.accounts.map((account) => (
          <tr key={account.key}>
            <th scope="row">{`@${account.handle}`}</th>
            {PLAIN_SOURCES.map((source) => (
              <SourceCell
                key={source}
                account={account}
                source={source}
                draft={props.draft}
                expired={props.expired}
                onToggle={props.onToggle}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
