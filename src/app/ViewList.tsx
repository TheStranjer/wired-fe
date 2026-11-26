/**
 * The inline list of views (WFE-298, decisions 12 and 13): one button per
 * row of ./paneMenu, shown in the open instead of behind a `▾` button. A
 * plain row runs `/<command> <view>`, a row that asks (`Hashtag…`,
 * `Profile…`, ...) opens the same dialog the pane menus do and runs the
 * completed line. The list takes one tab stop; the arrows, Home, End and a
 * typed letter move between rows (the keys of a menu), Enter chooses.
 * Parameterised by the command so the empty desktop (`vsplit`) and the start
 * menu (`float`) stay one list.
 */
import { useRef, useState } from 'react';
import type { JSX } from 'react';

import type { PaneAsk } from './paneAsk';
import { PaneAskDialog } from './PaneAskDialog';
import { askedLine, entryLine } from './paneMenu';
import type { PaneMenuEntry, ViewCommand } from './paneMenu';
import styles from './ViewList.module.css';
import { navTarget } from '../ui/menuNav';
import type { PostActionLine } from '../ui/postActionTypes';

/** The row whose dialog is open, and what it asks. */
type Asking = { readonly entry: PaneMenuEntry; readonly ask: PaneAsk };

/** What the list shows and runs. */
export type ViewListProps = {
  /** The command each row runs its view with. */
  readonly command: ViewCommand;
  /** The rows, top to bottom. */
  readonly entries: readonly PaneMenuEntry[];
  /** Accessible name of the list, and the label of its dialogs' field. */
  readonly label: string;
  /** Runs a chosen line. */
  readonly run: (line: PostActionLine) => void;
};

/** The rows as buttons in one tab stop, moved between with the menu's keys. */
function Rows(props: {
  readonly entries: readonly PaneMenuEntry[];
  readonly label: string;
  readonly choose: (entry: PaneMenuEntry) => void;
}): JSX.Element {
  const { entries, label, choose } = props;
  const listRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  return (
    <div
      aria-label={label}
      aria-orientation="vertical"
      className={styles['list']}
      onKeyDown={(event) => {
        const target = navTarget(entries, active, event);
        if (target !== null) {
          event.preventDefault();
          listRef.current?.querySelectorAll('button')[target]?.focus();
        }
      }}
      ref={listRef}
      role="toolbar"
    >
      {entries.map((entry, index) => (
        <button
          className={styles['row']}
          key={entry.id}
          onClick={() => {
            choose(entry);
          }}
          onFocus={() => {
            setActive(index);
          }}
          tabIndex={index === active ? 0 : -1}
          type="button"
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}

/** The list of {@link ViewListProps.entries}, each a button that runs `/<command> <view>`. */
export function ViewList(props: ViewListProps): JSX.Element {
  const { command, entries, label, run } = props;
  const [asking, setAsking] = useState<Asking | null>(null);
  const choose = (entry: PaneMenuEntry): void => {
    if (entry.ask === null) {
      run({ line: entryLine(entry, command), prefill: false });
    } else {
      setAsking({ entry, ask: entry.ask });
    }
  };
  return (
    <>
      <Rows entries={entries} label={label} choose={choose} />
      {asking === null ? null : (
        <PaneAskDialog
          ask={asking.ask}
          onCancel={() => {
            setAsking(null);
          }}
          onSubmit={(answer) => {
            setAsking(null);
            run({ line: askedLine(asking.entry, command, answer), prefill: false });
          }}
          verb={label}
        />
      )}
    </>
  );
}
