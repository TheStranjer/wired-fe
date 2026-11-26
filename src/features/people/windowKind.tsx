/**
 * The `people` window kind (AGENTS.md "Windows, like IRC buffers", decision
 * 13, WFE-220): who is in another window, as a view for any pane. The ref's
 * target is the watched window's id and its account the watched window's; the
 * list is today's nick list of that window's buffer, following it as lines
 * arrive. The watched window's kind names the list (`in thread`,
 * `in conversation`, `recently here`) or leaves it empty; a nick click opens
 * that account's profile window through the transition a nick click in a post
 * asks for (src/state/profileWindow). When the watched window closes the
 * window says so, dimly. Plain text typed here posts as the watched window's
 * account (src/state/postAsWindowAccount); a window with no account of its
 * own, such as a feed, posts through the posting account or the picker
 * (src/state/postAccountless, WFE-284).
 */

import type { JSX } from 'react';

import { PEOPLE_TITLES, listedPeople } from './peopleList';
import styles from './PeopleWindow.module.css';
import { useT } from '../../i18n/I18nProvider';
import { clickOpen } from '../../state/placementFromClick';
import { postAsWindowOrChoice } from '../../state/postAccountless';
import { profileWindowOpen } from '../../state/profileWindow';
import { accountByKey, bufferFor, windowAccountKey } from '../../state/selectors';
import { useAppDispatch, useAppState } from '../../state/StateContext';
import type { WindowKindDefinition } from '../../state/windowKind';
import { NickList } from '../../ui/NickList';
import type { WindowState } from '../../windows/model';

/** The list of the people in {@link watched}'s buffer. */
function People({ watched }: { readonly watched: WindowState }): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const t = useT();
  const title = PEOPLE_TITLES[watched.ref.kind];
  if (title === null) {
    return <p className={styles['notice']}>{t('features.people.nobody')}</p>;
  }
  const key = windowAccountKey(state, watched.id);
  const accounts = listedPeople(bufferFor(state, watched.id), accountByKey(state, key));
  return (
    <NickList
      title={t(title)}
      accounts={accounts}
      onSelect={(account, click) => {
        dispatch(clickOpen(state.settings, profileWindowOpen(account, key), click));
      }}
    />
  );
}

/** The people window: the list of the window its target names, or a notice. */
function PeopleWindow({ windowId }: { readonly windowId: string }): JSX.Element {
  const { windows } = useAppState().windows;
  const t = useT();
  const target = windows.find((candidate) => candidate.id === windowId)?.ref.target;
  const watched = windows.find((candidate) => candidate.id === target);
  if (watched === undefined) {
    return <p className={styles['notice']}>{t('features.people.window_closed')}</p>;
  }
  return <People watched={watched} />;
}

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'people',
  topic: (window) => window.title,
  Component: PeopleWindow,
  onPost: postAsWindowOrChoice,
};
