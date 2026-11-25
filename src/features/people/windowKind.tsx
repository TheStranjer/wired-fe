/**
 * The `people` window kind (AGENTS.md "Windows, like IRC buffers", decision
 * 13, WFE-220): who is in another window, as a view for any pane. The ref's
 * target is the watched window's id and its account the watched window's; the
 * list is today's nick list of that window's buffer, following it as lines
 * arrive. The watched window's kind names the list (`in thread`,
 * `in conversation`, `recently here`) or leaves it empty; a nick click opens
 * that account's profile window through the transition a nick click in a post
 * asks for (src/state/profileWindow). When the watched window closes the
 * window says so, dimly. Nothing is posted into it: the definition carries no
 * `onPost`.
 */

import type { JSX } from 'react';

import { PEOPLE_TITLES, listedPeople } from './peopleList';
import styles from './PeopleWindow.module.css';
import { profileWindowOpen } from '../../state/profileWindow';
import { accountByKey, bufferFor, windowAccountKey } from '../../state/selectors';
import { useAppDispatch, useAppState } from '../../state/StateContext';
import type { WindowKindDefinition } from '../../state/windowKind';
import { NickList } from '../../ui/NickList';
import type { WindowState } from '../../windows/model';

/** What the window says when the window it watches is gone. */
const WINDOW_CLOSED = 'window closed';

/** What the window says for a watched kind that gathers nobody. */
const NOBODY_GATHERED = 'nobody gathered here';

/** The list of the people in {@link watched}'s buffer. */
function People({ watched }: { readonly watched: WindowState }): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const title = PEOPLE_TITLES[watched.ref.kind];
  if (title === null) {
    return <p className={styles['notice']}>{NOBODY_GATHERED}</p>;
  }
  const key = windowAccountKey(state, watched.id);
  const accounts = listedPeople(bufferFor(state, watched.id), accountByKey(state, key));
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

/** The people window: the list of the window its target names, or a notice. */
function PeopleWindow({ windowId }: { readonly windowId: string }): JSX.Element {
  const { windows } = useAppState().windows;
  const target = windows.find((candidate) => candidate.id === windowId)?.ref.target;
  const watched = windows.find((candidate) => candidate.id === target);
  if (watched === undefined) {
    return <p className={styles['notice']}>{WINDOW_CLOSED}</p>;
  }
  return <People watched={watched} />;
}

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'people',
  topic: (window) => window.title,
  Component: PeopleWindow,
};
