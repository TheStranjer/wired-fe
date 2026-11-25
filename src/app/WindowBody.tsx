/**
 * A window's contents, as the shell draws them: the window kind's own
 * component, or a notice when the kind never loaded, plus the kind's topic.
 * Shared by the desktop's panes and the topic bar.
 */
import { useState } from 'react';
import type { JSX } from 'react';

import { WINDOW_KINDS } from './loadedKinds';
import type { ClockFormat } from '../lib/time';
import type { AppState } from '../state/appState';
import { Scrollback } from '../ui/Scrollback';
import { SystemLine } from '../ui/SystemLine';
import type { WindowState } from '../windows/model';

/** What the scrollback says when the window's kind has no component. */
const NO_VIEW = 'No view for this window';

/** The stand-in scrollback for a window whose kind never loaded. */
function NoView(props: { readonly title: string; readonly clockFormat: ClockFormat }): JSX.Element {
  const [date] = useState(() => new Date());
  return (
    <Scrollback label={props.title}>
      <SystemLine clockFormat={props.clockFormat} date={date} level="error" text={NO_VIEW} />
    </Scrollback>
  );
}

/** The window kind's own component for {@link win}, or a notice. */
export function WindowBody(props: {
  readonly win: WindowState;
  readonly state: AppState;
}): JSX.Element {
  const { win, state } = props;
  const kind = WINDOW_KINDS.get(win.ref.kind);
  if (kind === undefined) {
    return <NoView clockFormat={state.settings.clockFormat} title={win.title} />;
  }
  const Body = kind.Component;
  return <Body windowId={win.id} />;
}

/** The window kind's topic text for {@link win}; empty when the kind never loaded. */
export function windowTopic(win: WindowState, state: AppState): string {
  const kind = WINDOW_KINDS.get(win.ref.kind);
  return kind === undefined ? '' : kind.topic(win, state);
}
