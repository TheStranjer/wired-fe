/**
 * The side pane (WFE-133, AGENTS.md "Windows, like IRC buffers"): who is in
 * the window the shell shows. The window's kind names the pane — `in thread`,
 * `in conversation`, `recently here` — or leaves it empty (the status window,
 * search and notifications speak about nobody gathered); otherwise the
 * buffer's participants fill it in nick-list order, named the way the
 * scrollback names them from the window's own account. Clicking a nick opens
 * that account's profile window through the very transition a nick click in a
 * post asks for (src/state/profileWindow).
 */

import type { JSX } from 'react';

import type { StoredAccount } from '../accounts/accountStore';
import { fullHandle } from '../accounts/handle';
import { profileWindowOpen } from '../state/profileWindow';
import { accountByKey, bufferFor, windowAccountKey } from '../state/selectors';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { NickList } from '../ui/NickList';
import type { ListedAccount } from '../ui/NickList';
import { participants } from '../views/participants';
import type { WindowKind, WindowState } from '../windows/model';

/** One participant, as ../views/participants hands it over; this layer names
 * no api type (AGENTS.md "Layout"), so the type is taken from the function. */
type Author = ReturnType<typeof participants>[number];

/** How many nicks the pane lists at most. */
const PANE_LIMIT = 50;

/** The pane's heading for a window kind; null leaves the pane empty. */
const PANE_TITLES: Record<WindowKind, string | null> = {
  status: null,
  home: 'recently here',
  local: 'recently here',
  federated: 'recently here',
  hashtag: 'recently here',
  profile: 'recently here',
  notifications: null,
  search: null,
  thread: 'in thread',
  dm: 'in conversation',
  composer: null,
  feed: null,
};

/** The account's full handle as the window's account grounds it; alone if none. */
function handleOf(account: Author, viewer: StoredAccount | null): string {
  return viewer === null ? (account.fqn ?? account.acct) : fullHandle(account, viewer.origin);
}

/** One participant as the pane shows it: named, and flagged when it is me. */
function listed(account: Author, viewer: StoredAccount | null): ListedAccount {
  return {
    id: account.id,
    acct: account.acct,
    fullHandle: `@${handleOf(account, viewer)}`,
    self: viewer !== null && account.id === viewer.accountId,
  };
}

/** Props of {@link SidePane}: the window the shell is showing. */
type SidePaneProps = {
  readonly win: WindowState;
};

/** Who is in this window: its participants as a clickable nick list. */
export function SidePane(props: SidePaneProps): JSX.Element | null {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const title = PANE_TITLES[props.win.ref.kind];
  if (title === null) {
    return null;
  }
  const key = windowAccountKey(state, props.win.id);
  const viewer = accountByKey(state, key);
  const accounts = participants(bufferFor(state, props.win.id), PANE_LIMIT).map((account) =>
    listed(account, viewer),
  );
  return (
    <NickList
      title={title}
      accounts={accounts}
      onSelect={(account) => {
        dispatch({ type: 'windows', action: profileWindowOpen(account, key) });
      }}
    />
  );
}
