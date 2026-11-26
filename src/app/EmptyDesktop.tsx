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
import { useT } from '../i18n/I18nProvider';
import { useAppState } from '../state/StateContext';
import { usePostActions } from '../views/PostActionsContext';

/** The hint and the view list of a desktop with no pane. */
export function EmptyDesktop(): JSX.Element {
  const registry = useAvailableRegistry();
  const { settings } = useAppState();
  const { run } = usePostActions();
  const t = useT();
  const entries = useMemo(
    () => launcherEntries(paneMenuEntries(registry, settings.feeds, t)),
    [registry, settings.feeds, t],
  );
  return (
    <div className={styles['empty']}>
      <div className={styles['hint']}>{t('app.empty_desktop_hint')}</div>
      <div className={styles['views']}>
        <ViewList command="vsplit" entries={entries} label={t('app.open_view')} run={run} />
      </div>
    </div>
  );
}
