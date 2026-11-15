/**
 * The shell wired to real state (AGENTS.md "Windows, like IRC buffers"):
 * every region is drawn from the app state the AppStateProvider above holds.
 * The active window's kind decides its topic and scrollback; the window list,
 * the active account, the clock and the hotkey mode fill the status line;
 * the command line holds its own text until the command layer takes it over.
 * The window kinds are collected once, when this module loads; a load that
 * failed prints its reason into the status window once, on mount.
 */

import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { Shell } from './Shell';
import { useClock } from './useClock';
import { loadWindowKinds } from './windowKinds';
import type { ClockFormat } from '../lib/time';
import type { AppState } from '../state/appState';
import { accountByKey } from '../state/selectors';
import { useAppDispatch, useAppState } from '../state/StateContext';
import type { WindowKindDefinition } from '../state/windowKind';
import { InputLine } from '../ui/InputLine';
import { Scrollback } from '../ui/Scrollback';
import { StatusLine } from '../ui/StatusLine';
import type { StatusLineWindow } from '../ui/StatusLine';
import { SystemLine } from '../ui/SystemLine';
import { TopicBar } from '../ui/TopicBar';
import { STATUS_WINDOW_ID, activeWindow } from '../windows/model';
import type { WindowKind, WindowState } from '../windows/model';

/** The one load of the self-registered kinds, shared by every mount. */
const KINDS = loadWindowKinds();

/** The kind map the shell draws from; empty when the load failed. */
const WINDOW_KINDS: ReadonlyMap<WindowKind, WindowKindDefinition> = KINDS.ok
  ? KINDS.value
  : new Map();

/** What the scrollback says when the window's kind has no component. */
const NO_VIEW = 'No view for this window';

/** Props of the two regions that draw the active window, and all of state. */
type RegionProps = {
  readonly win: WindowState;
  readonly state: AppState;
};

/** The account behind {@link key}, named the way the bars show it; null if none. */
function accountLabel(state: AppState, key: string | null): string | null {
  const account = accountByKey(state, key);
  return account === null ? null : `@${account.handle}`;
}

/** The status line's entries: every window, numbered in display order. */
function statusWindows(state: AppState): readonly StatusLineWindow[] {
  const active = activeWindow(state.windows);
  return state.windows.windows.map((win, index) => ({
    number: index + 1,
    title: win.title,
    unread: win.unread,
    highlight: win.highlight,
    active: win.id === active.id,
  }));
}

/** The topic bar: the window's title, its account and its kind's topic. */
function Topic(props: RegionProps): JSX.Element {
  const { win, state } = props;
  const kind = WINDOW_KINDS.get(win.ref.kind);
  return (
    <TopicBar
      windowTitle={win.title}
      accountLabel={accountLabel(state, win.ref.accountKey)}
      topic={kind === undefined ? '' : kind.topic(win, state)}
    />
  );
}

/** The stand-in scrollback for a window whose kind never loaded. */
function NoView(props: { readonly title: string; readonly clockFormat: ClockFormat }): JSX.Element {
  const [date] = useState(() => new Date());
  return (
    <Scrollback label={props.title}>
      <SystemLine clockFormat={props.clockFormat} date={date} level="error" text={NO_VIEW} />
    </Scrollback>
  );
}

/** The scrollback: the active window kind's own component, or a notice. */
function WindowBody(props: RegionProps): JSX.Element {
  const { win, state } = props;
  const kind = WINDOW_KINDS.get(win.ref.kind);
  if (kind === undefined) {
    return <NoView clockFormat={state.settings.clockFormat} title={win.title} />;
  }
  const Body = kind.Component;
  return <Body windowId={win.id} />;
}

/** The five shell regions, filled from the app state above it. */
export function Root(): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const active = activeWindow(state.windows);
  const clock = useClock(state.settings.clockFormat);
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!KINDS.ok) {
      dispatch({
        type: 'print',
        windowId: STATUS_WINDOW_ID,
        date: new Date(),
        level: 'error',
        text: KINDS.error,
      });
    }
  }, [dispatch]);

  function submitLine(): void {
    // Command handling is the next ticket; submitting only clears the line.
    setValue('');
  }

  return (
    <Shell
      topic={<Topic win={active} state={state} />}
      scrollback={<WindowBody win={active} state={state} />}
      sidePane={null}
      statusLine={
        <StatusLine
          clock={clock}
          accountLabel={accountLabel(state, state.activeAccountKey)}
          windows={statusWindows(state)}
          mode={state.mode}
          onSelectWindow={(number: number) => {
            dispatch({ type: 'windows', action: { type: 'activateNumber', number } });
          }}
        />
      }
      input={<InputLine prompt=">" value={value} onChange={setValue} onSubmit={submitLine} />}
    />
  );
}
