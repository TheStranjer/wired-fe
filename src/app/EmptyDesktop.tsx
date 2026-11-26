/**
 * What an empty desktop draws (WFE-298, decision 12): the one dim hint line
 * and, under it, the views the pane menus offer as a clickable list, so the
 * mouse has a way in too. A row runs `/vsplit <view>` through the command
 * runner, and the view becomes the desktop's first pane. There is no pane to
 * focus, so this does not go through the pane runner.
 */
import { useMemo } from 'react';
import type { JSX } from 'react';

import styles from './EmptyDesktop.module.css';
import { launcherEntries } from './launcherEntries';
import { paneMenuEntries } from './paneMenu';
import { useAvailableRegistry } from './useAvailableRegistry';
import { ViewList } from './ViewList';
import { useAppState } from '../state/StateContext';
import { usePostActions } from '../views/PostActionsContext';

/** The hint and the view list of a desktop with no pane. */
export function EmptyDesktop(): JSX.Element {
  const registry = useAvailableRegistry();
  const { settings } = useAppState();
  const { run } = usePostActions();
  const entries = useMemo(
    () => launcherEntries(paneMenuEntries(registry, settings.feeds)),
    [registry, settings.feeds],
  );
  return (
    <div className={styles['empty']}>
      <div className={styles['hint']}>empty desktop — /vsplit, /split or Ctrl+B %</div>
      <div className={styles['views']}>
        <ViewList command="vsplit" entries={entries} label="Open a view" run={run} />
      </div>
    </div>
  );
}
