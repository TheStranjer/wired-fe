/**
 * The composer window's "Post as" picker (decision 13): a select over every
 * signed-in account. Choosing one is the window's business (it points itself at
 * that account, so the character limit and the audiences follow the new
 * account's instance, decision 5); the picker only names the choices.
 */

import type { ChangeEvent, JSX } from 'react';

import styles from './PostAs.module.css';
import type { StoredAccount } from '../../accounts/accountStore';
import { useT } from '../../i18n/I18nProvider';

/** What the picker shows and the one thing it does. */
type PostAsProps = {
  readonly accounts: readonly StoredAccount[];
  /** The key of the account the window posts as. */
  readonly value: string | null;
  /** The account the user picked, by key. */
  readonly onPick: (accountKey: string) => void;
};

/** The select over the signed-in accounts, named "Post as". */
export function PostAs(props: PostAsProps): JSX.Element {
  const t = useT();
  return (
    <label className={styles['from']}>
      <span>{t('features.composer.post_as')}</span>
      <select
        className={styles['select']}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => {
          props.onPick(event.target.value);
        }}
        value={props.value ?? ''}
      >
        {props.accounts.map((account) => (
          <option key={account.key} value={account.key}>
            {`@${account.handle}`}
          </option>
        ))}
      </select>
    </label>
  );
}
