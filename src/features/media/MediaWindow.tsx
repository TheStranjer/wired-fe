/**
 * The media window (WFE-263): finds the post and attachment its target names,
 * loads the post as the window's own account (./useMediaStatus) and shows the
 * attachment (./MediaViewer). Until the instance answers it says `loading…`
 * dimly; a failed load prints the words `describeApiError` has for it. A window
 * whose target is not a media target, or that has gone, says there is nothing
 * to show.
 */
import type { JSX } from 'react';

import { MediaViewer } from './MediaViewer';
import styles from './MediaViewer.module.css';
import { useMediaStatus } from './useMediaStatus';
import { type MediaTarget, parseMediaTarget } from '../../state/mediaWindow';
import { accountByKey } from '../../state/selectors';
import { useAppState } from '../../state/StateContext';
import type { WindowState } from '../../windows/model';

/** The window {@link props.win} once its target is known to be a media target. */
function Loaded(props: { readonly win: WindowState; readonly target: MediaTarget }): JSX.Element {
  const { win, target } = props;
  const state = useAppState();
  const owner = accountByKey(state, win.ref.accountKey);
  const load = useMediaStatus(target.statusId, owner?.key ?? null);
  switch (load.kind) {
    case 'loading':
      return <p className={styles['notice']}>loading…</p>;
    case 'failed':
      return <p className={styles['error']}>{load.text}</p>;
    case 'ready':
      return <MediaViewer n={target.n} status={load.status} win={win} />;
  }
}

/** The media window {@link props.windowId}, or a notice that it has nothing to show. */
export function MediaWindow(props: { readonly windowId: string }): JSX.Element {
  const { windows } = useAppState().windows;
  const win = windows.find((candidate) => candidate.id === props.windowId);
  const target = parseMediaTarget(win?.ref.target ?? null);
  if (win === undefined || target === null) {
    return <p className={styles['notice']}>Nothing to show</p>;
  }
  return <Loaded target={target} win={win} />;
}
