/**
 * One view-menu button of a pane's title bar (WFE-229, WFE-269, WFE-270):
 * `┃▾`, `━▾` or `⧉▾` over the rows of ./paneMenu. A plain row runs its line
 * through the pane runner at once, a row that asks (`Hashtag…`, `Profile…`,
 * ...) opens its dialog first and runs the completed line when it is
 * answered, and `Existing window…` opens a second level listing the other
 * open windows and runs `/<command> win N` for the one chosen. No row fills
 * the command line.
 */
import { useState } from 'react';
import type { JSX } from 'react';

import { PaneAskDialog } from './PaneAskDialog';
import { askedLine, entryLine } from './paneMenu';
import type { PaneAsk, PaneMenuEntry, ViewCommand } from './paneMenu';
import { pickedWindowLine, windowPickerItems } from './windowPicker';
import { useAppState } from '../state/StateContext';
import { MenuButton } from '../ui/MenuButton';
import type { MenuItem } from '../ui/MenuButton';
import type { PostActionLine } from '../ui/postActionTypes';

/** One of the view-menu buttons: its glyph, accessible name and command. */
export type SplitButton = {
  readonly glyph: string;
  readonly label: string;
  readonly command: ViewCommand;
};

/** The row whose dialog is open, and what it asks. */
type Asking = { readonly entry: PaneMenuEntry; readonly ask: PaneAsk };

/** One view-menu button over {@link entries}, on the pane that shows the window `ownWindowId`. */
export function SplitMenu(props: {
  readonly button: SplitButton;
  readonly entries: readonly PaneMenuEntry[];
  readonly runOnPane: (line: PostActionLine) => void;
  readonly ownWindowId: string;
}): JSX.Element {
  const { button, entries, runOnPane, ownWindowId } = props;
  const state = useAppState();
  const [asking, setAsking] = useState<Asking | null>(null);
  const select = (id: string): void => {
    const picked = pickedWindowLine(id, button.command);
    if (picked !== null) {
      runOnPane({ line: picked, prefill: false });
      return;
    }
    for (const entry of entries.filter((candidate) => candidate.id === id)) {
      if (entry.ask === null) {
        runOnPane({ line: entryLine(entry, button.command), prefill: false });
      } else {
        setAsking({ entry, ask: entry.ask });
      }
    }
  };
  const drill = (id: string): readonly MenuItem[] | null =>
    entries.some((entry) => entry.id === id && entry.pick === 'window')
      ? windowPickerItems(state, ownWindowId)
      : null;
  return (
    <>
      <MenuButton
        label={button.label}
        glyph={button.glyph}
        items={entries}
        onSelect={select}
        drill={drill}
      />
      {asking === null ? null : (
        <PaneAskDialog
          ask={asking.ask}
          onCancel={() => {
            setAsking(null);
          }}
          onSubmit={(answer) => {
            setAsking(null);
            runOnPane({ line: askedLine(asking.entry, button.command, answer), prefill: false });
          }}
          verb={button.label}
        />
      )}
    </>
  );
}
