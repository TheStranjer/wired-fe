/**
 * The split buttons of a tree pane (WFE-229, WFE-269, WFE-270): `◫▾` and `⊟▾`,
 * each a menu of views that runs `/vsplit <view>` or `/split <view>` on its
 * pane. The rows that need an argument ask for it in a dialog, and
 * `Existing window…` opens a second level listing the other open windows (see
 * ./SplitMenu). Floating a pane is the plain `⧉` button beside them
 * (./PaneActions); opening a view as a float is the start menu (./StartMenu).
 */
import { useMemo } from 'react';
import type { JSX } from 'react';

import { paneMenuEntries } from './paneMenu';
import { SplitMenu } from './SplitMenu';
import type { SplitButton } from './SplitMenu';
import { useAvailableRegistry } from './useAvailableRegistry';
import { useRunOnPane } from './useRunOnPane';
import { useT } from '../i18n/I18nProvider';
import type { Translate } from '../i18n/messages';
import { useAppState } from '../state/StateContext';
import type { WindowState } from '../windows/model';

/** The split buttons, side by side first, worded by {@link t}. */
function splitButtons(t: Translate): readonly SplitButton[] {
  return [
    {
      glyph: '◫▾',
      label: t('app.split_side_by_side'),
      action: t('app.split_side_by_side_tip'),
      command: 'vsplit',
    },
    {
      glyph: '⊟▾',
      label: t('app.split_stacked'),
      action: t('app.split_stacked_tip'),
      command: 'split',
    },
  ];
}

/** The split buttons of the tree pane `paneId`, which shows the window `win`. */
export function TreeButtons(props: {
  readonly paneId: string;
  readonly win: WindowState;
}): JSX.Element {
  const registry = useAvailableRegistry();
  const { settings } = useAppState();
  const t = useT();
  const runOnPane = useRunOnPane(props.paneId);
  const ownWindowId = props.win.id;
  const entries = useMemo(
    () => paneMenuEntries(registry, settings.feeds, t),
    [registry, settings.feeds, t],
  );
  return (
    <>
      {splitButtons(t).map((button) => (
        <SplitMenu
          key={button.command}
          button={button}
          entries={entries}
          runOnPane={runOnPane}
          ownWindowId={ownWindowId}
        />
      ))}
    </>
  );
}
