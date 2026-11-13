/**
 * Root component: the shell layout filled with static placeholder content,
 * until the window, command and account layers make it live.
 */
import { useState } from 'react';
import type { JSX } from 'react';

import styles from './App.module.css';
import { Shell } from './Shell';
import { InputLine } from '../ui/InputLine';
import { Scrollback } from '../ui/Scrollback';
import { StatusLine } from '../ui/StatusLine';
import type { StatusLineWindow } from '../ui/StatusLine';
import { TopicBar } from '../ui/TopicBar';

/** The one placeholder window shown until the window store exists. */
const PLACEHOLDER_WINDOWS: readonly StatusLineWindow[] = [
  { number: 1, title: 'status', unread: 0, highlight: false, active: true },
];

/** Window entries are clickable but inert until the windows layer owns selection. */
function selectWindow(): void {
  // There is no window state to change yet.
}

/** The whole application: the shell with placeholder content. */
export function App(): JSX.Element {
  const [value, setValue] = useState('');

  function submitLine(): void {
    setValue('');
  }

  return (
    <>
      <h1 className={styles['visuallyHidden']}>WIRED</h1>
      <Shell
        topic={
          <TopicBar windowTitle="status" accountLabel={null} topic="Present day. Present time." />
        }
        scrollback={
          <Scrollback label="status">
            <p>WIRED // not connected</p>
          </Scrollback>
        }
        sidePane={null}
        statusLine={
          <StatusLine
            clock="--:--"
            accountLabel={null}
            windows={PLACEHOLDER_WINDOWS}
            mode="insert"
            onSelectWindow={selectWindow}
          />
        }
        input={<InputLine prompt=">" value={value} onChange={setValue} onSubmit={submitLine} />}
      />
    </>
  );
}
