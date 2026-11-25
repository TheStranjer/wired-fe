/**
 * The split and pop-out buttons of a tree pane (WFE-229, WFE-269, WFE-270):
 * `┃▾`, `━▾` and `⧉▾`, each a menu of views that runs `/vsplit <view>`,
 * `/split <view>` or `/float <view>` on its pane. The rows that need an
 * argument ask for it in a dialog, and `Existing window…` opens a second
 * level listing the other open windows (see ./SplitMenu).
 */
import { useMemo } from 'react';
import type { JSX } from 'react';

import { paneMenuEntries, popOutEntries } from './paneMenu';
import { SplitMenu } from './SplitMenu';
import type { SplitButton } from './SplitMenu';
import { useAvailableRegistry } from './useAvailableRegistry';
import { useRunOnPane } from './useRunOnPane';
import { useAppState } from '../state/StateContext';
import type { WindowState } from '../windows/model';

/** The split buttons, side by side first. */
const SPLIT_BUTTONS: readonly SplitButton[] = [
  { glyph: '┃▾', label: 'Split side by side', command: 'vsplit' },
  { glyph: '━▾', label: 'Split stacked', command: 'split' },
];

/** The pop-out button, which takes `This pane` as well as the views. */
const POP_OUT: SplitButton = { glyph: '⧉▾', label: 'Pop out', command: 'float' };

/** The split and pop-out buttons of the tree pane `paneId`, which shows the window `win`. */
export function TreeButtons(props: {
  readonly paneId: string;
  readonly win: WindowState;
}): JSX.Element {
  const registry = useAvailableRegistry();
  const { settings } = useAppState();
  const runOnPane = useRunOnPane(props.paneId);
  const ownWindowId = props.win.id;
  const entries = useMemo(
    () => paneMenuEntries(registry, settings.feeds),
    [registry, settings.feeds],
  );
  const popOut = useMemo(() => popOutEntries(entries), [entries]);
  return (
    <>
      {SPLIT_BUTTONS.map((button) => (
        <SplitMenu
          key={button.command}
          button={button}
          entries={entries}
          runOnPane={runOnPane}
          ownWindowId={ownWindowId}
        />
      ))}
      <SplitMenu
        button={POP_OUT}
        entries={popOut}
        runOnPane={runOnPane}
        ownWindowId={ownWindowId}
      />
    </>
  );
}
