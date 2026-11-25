/**
 * A running command line for component tests (AGENTS.md "Testing"):
 * {@link renderWithLines} draws a view over a session and hands it a runner of
 * command lines which runs them through the real `/feed` over the session's
 * live state and reducer, the way the app does, telling a spy which lines it
 * ran; beside the view it draws a probe that shows the saved feeds, the open
 * windows and which of them the panes show, so a test can see what the lines
 * did.
 */
import { render } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { vi } from 'vitest';
import type { Mock } from 'vitest';

import { fakeCommandContext } from './commandContext';
import { command as feed } from '../commands/defs/feed';
import { runLines } from '../commands/runLines';
import type { CommandOutcome, Registry } from '../commands/types';
import type { AppState } from '../state/appState';
import { AppStateProvider, useAppDispatch, useAppState } from '../state/StateContext';
import { shownPanes } from '../windows/desktopPanes';
import { activeDesktop } from '../windows/desktops';

/** Something that runs command lines in order, as the app's command line does. */
type LiveRun = (lines: readonly string[]) => Promise<CommandOutcome>;

/** Hears every list of lines that was run. */
type LinesSpy = Mock<(lines: readonly string[]) => void>;

/** The registry with `/feed` alone. */
const FEED_ONLY: Registry = { commands: [feed], byName: new Map([['feed', feed]]) };

/** Calls its children with a {@link LiveRun} over the state around it; {@link spy} hears every list of lines run. */
function LiveLines(props: {
  readonly spy: LinesSpy;
  readonly children: (run: LiveRun) => ReactNode;
}): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const run: LiveRun = async (lines) => {
    props.spy(lines);
    const context = fakeCommandContext({
      state,
      windows: state.windows,
      dispatch,
      dispatchWindows: (action) => {
        dispatch({ type: 'windows', action });
      },
      registry: FEED_ONLY,
    });
    return await runLines(lines, context);
  };
  return <>{props.children(run)}</>;
}

/** The names of the saved feeds, the titles of the open windows and the ids of the windows the panes show, as one labelled line. */
function DeskProbe(): JSX.Element {
  const { settings, windows, layout } = useAppState();
  const feeds = settings.feeds.map((one) => one.name).join(',');
  const titles = windows.windows.map((win) => win.title).join(',');
  const shown = shownPanes(activeDesktop(layout))
    .map((pane) => pane.windowId)
    .join(',');
  return (
    <output aria-label="desk">{`feeds: ${feeds} | windows: ${titles} | shown: ${shown}`}</output>
  );
}

/** Draw what {@link view} makes of a live runner over {@link state}, with the probe beside it; returns the spy of the lines run. */
export function renderWithLines(state: AppState, view: (run: LiveRun) => ReactNode): LinesSpy {
  const spy: LinesSpy = vi.fn();
  render(
    <AppStateProvider initial={state}>
      <LiveLines spy={spy}>{view}</LiveLines>
      <DeskProbe />
    </AppStateProvider>,
  );
  return spy;
}
