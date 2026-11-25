/**
 * Shared test helper for the `/feed` commands (decision 14): a running session
 * over the real app reducer in which `/feed` moves the settings and the window
 * list, with the client messages it prints kept for assertions.
 */
import { fakeCommandContext } from './commandContext';
import { LAIN, ALICE } from './splitDesk';
import { command } from '../commands/defs/feed';
import type { CommandOutcome } from '../commands/types';
import { type AppState, initialAppState } from '../state/appState';
import type { Feeds } from '../state/feeds';
import { type AppAction, appReducer } from '../state/reducer';

export { ALICE, LAIN };

/** A running session: `/feed` runs against its current state, which it moves. */
export type FeedDesk = {
  readonly state: () => AppState;
  readonly feeds: () => Feeds;
  readonly printed: readonly string[];
  readonly run: (args: string) => Promise<CommandOutcome>;
};

/** A session signed in as lain and alice (alice active) with {@link feeds} already saved. */
export function feedDesk(feeds: Feeds = []): FeedDesk {
  const printed: string[] = [];
  let state = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN, ALICE],
    activeKey: ALICE.key,
  });
  const dispatch = (action: AppAction): void => {
    state = appReducer(state, action);
  };
  dispatch({ type: 'settings', settings: { feeds } });
  return {
    state: () => state,
    feeds: () => state.settings.feeds,
    printed,
    run: async (args) =>
      await command.run(
        args,
        fakeCommandContext({
          state,
          windows: state.windows,
          dispatch,
          dispatchWindows: (action) => {
            dispatch({ type: 'windows', action });
          },
          print: (text) => {
            printed.push(text);
          },
        }),
      ),
  };
}
