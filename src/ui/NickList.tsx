/**
 * The side pane's nick list (WFE-133, AGENTS.md "Windows, like IRC buffers"):
 * a heading over one clickable `<nick>` per account, in the order the caller
 * lists them. Presentational like {@link Nick} itself: who belongs on the list
 * and what a click means are the caller's business — the title, the accounts
 * and onSelect all arrive as props.
 */
import type { JSX } from 'react';

import { Nick } from './Nick';
import styles from './NickList.module.css';

/** One account on the list: the ui twin (AGENTS.md "Layout": this layer never
 * sees api types) of a line's author, enough to draw its nick and to report a
 * click back so the caller can name the window it opens. */
export type ListedAccount = {
  /** The account's id: what a click names whose profile window to open. */
  readonly id: string;
  /** What the nick shows, e.g. "alice" or "alice@m.example". */
  readonly acct: string;
  /** The full handle, e.g. "@alice@m.example", for the title and accessible name. */
  readonly fullHandle: string;
  /** True when this nick is the current user's own. */
  readonly self: boolean;
};

/** Props of {@link NickList}. */
export type NickListProps = {
  /** The heading above the list: what the list is of. */
  readonly title: string;
  /** The accounts to list, in display order. */
  readonly accounts: readonly ListedAccount[];
  /** Called with the account whose nick was clicked. */
  readonly onSelect: (account: ListedAccount) => void;
};

/** One entry: the account's nick, which reports its own account when clicked. */
function NickEntry(props: {
  readonly account: ListedAccount;
  readonly onSelect: (account: ListedAccount) => void;
}): JSX.Element {
  const { account, onSelect } = props;
  return (
    <li>
      <Nick
        handle={account.acct}
        fullHandle={account.fullHandle}
        self={account.self}
        onSelect={() => {
          onSelect(account);
        }}
      />
    </li>
  );
}

/** The heading and its list of nicks, empty or not. */
export function NickList(props: NickListProps): JSX.Element {
  const { title, accounts, onSelect } = props;
  return (
    <div className={styles['pane']}>
      <p className={styles['heading']}>{title}</p>
      <ul aria-label={title} className={styles['list']}>
        {accounts.map((account) => (
          <NickEntry key={account.id} account={account} onSelect={onSelect} />
        ))}
      </ul>
    </div>
  );
}
