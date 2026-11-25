/**
 * One view-menu button of a pane's title bar (WFE-229, WFE-269): `┃▾`, `━▾`
 * or `⧉▾` over the rows of ./paneMenu. A plain row runs its line through the
 * pane runner at once, a row that asks (`Hashtag…`, `Profile…`, ...) opens
 * its dialog first and runs the completed line when it is answered, and
 * `Existing window…` fills the command line for the user to finish.
 */
import { useState } from 'react';
import type { JSX } from 'react';

import { PaneAskDialog } from './PaneAskDialog';
import { askedLine, entryLine } from './paneMenu';
import type { PaneAsk, PaneMenuEntry, ViewCommand } from './paneMenu';
import { MenuButton } from '../ui/MenuButton';
import type { PostActionLine } from '../ui/postActionTypes';

/** One of the view-menu buttons: its glyph, accessible name and command. */
export type SplitButton = {
  readonly glyph: string;
  readonly label: string;
  readonly command: ViewCommand;
};

/** The row whose dialog is open, and what it asks. */
type Asking = { readonly entry: PaneMenuEntry; readonly ask: PaneAsk };

/** One view-menu button over {@link entries}. */
export function SplitMenu(props: {
  readonly button: SplitButton;
  readonly entries: readonly PaneMenuEntry[];
  readonly runOnPane: (line: PostActionLine) => void;
}): JSX.Element {
  const { button, entries, runOnPane } = props;
  const [asking, setAsking] = useState<Asking | null>(null);
  const select = (id: string): void => {
    for (const entry of entries.filter((candidate) => candidate.id === id)) {
      if (entry.ask === null) {
        runOnPane({ line: entryLine(entry, button.command), prefill: entry.prefill });
      } else {
        setAsking({ entry, ask: entry.ask });
      }
    }
  };
  return (
    <>
      <MenuButton label={button.label} glyph={button.glyph} items={entries} onSelect={select} />
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
