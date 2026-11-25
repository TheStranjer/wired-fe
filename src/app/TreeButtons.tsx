/**
 * The split and pop-out buttons of a tree pane (WFE-229, WFE-270): `┃▾`, `━▾`
 * and `⧉▾`, each a menu of views that runs `/vsplit <view>`, `/split <view>` or
 * `/float <view>` on its pane. `Existing window…` opens a second level listing
 * the other open windows and runs `/<command> win N` for the one chosen.
 */
import { useMemo } from 'react';
import type { JSX } from 'react';

import { entryLine, paneMenuEntries, popOutEntries } from './paneMenu';
import type { PaneMenuEntry, ViewCommand } from './paneMenu';
import { useAvailableRegistry } from './useAvailableRegistry';
import { useRunOnPane } from './useRunOnPane';
import { pickedWindowLine, windowPickerItems } from './windowPicker';
import { useAppState } from '../state/StateContext';
import { MenuButton } from '../ui/MenuButton';
import type { MenuItem } from '../ui/MenuButton';
import type { PostActionLine } from '../ui/postActionTypes';
import type { WindowState } from '../windows/model';

/** One of the view-menu buttons: its glyph, accessible name and command. */
type SplitButton = {
  readonly glyph: string;
  readonly label: string;
  readonly command: ViewCommand;
};

/** The split buttons, side by side first. */
const SPLIT_BUTTONS: readonly SplitButton[] = [
  { glyph: '┃▾', label: 'Split side by side', command: 'vsplit' },
  { glyph: '━▾', label: 'Split stacked', command: 'split' },
];

/** The pop-out button, which takes `This pane` as well as the views. */
const POP_OUT: SplitButton = { glyph: '⧉▾', label: 'Pop out', command: 'float' };

/** One view-menu button over {@link entries}, on the pane that shows the window `ownWindowId`. */
function SplitMenu(props: {
  readonly button: SplitButton;
  readonly entries: readonly PaneMenuEntry[];
  readonly runOnPane: (line: PostActionLine) => void;
  readonly ownWindowId: string;
}): JSX.Element {
  const { button, entries, runOnPane, ownWindowId } = props;
  const state = useAppState();
  const select = (id: string): void => {
    const picked = pickedWindowLine(id, button.command);
    if (picked !== null) {
      runOnPane({ line: picked, prefill: false });
      return;
    }
    for (const entry of entries.filter((candidate) => candidate.id === id)) {
      runOnPane({ line: entryLine(entry, button.command), prefill: entry.prefill });
    }
  };
  const drill = (id: string): readonly MenuItem[] | null =>
    entries.some((entry) => entry.id === id && entry.pick === 'window')
      ? windowPickerItems(state, ownWindowId)
      : null;
  return (
    <MenuButton
      label={button.label}
      glyph={button.glyph}
      items={entries}
      onSelect={select}
      drill={drill}
    />
  );
}

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
