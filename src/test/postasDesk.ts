/**
 * Shared test helper for `/postas` (WFE-281): a running session over the real
 * app reducer, signed in as lain (active) and alice, in which the command
 * moves the settings, with the client messages it prints kept for assertions.
 */
import { fakeCommandContext } from './commandContext';
import { ALICE, LAIN } from './splitDesk';
import { command } from '../commands/defs/postas';
import type { CommandOutcome } from '../commands/types';
import { type AppState, initialAppState } from '../state/appState';
import type { FeedSpec, Feeds } from '../state/feeds';
import { feedWindowOpen } from '../state/feedWindow';
import { type AppAction, appReducer } from '../state/reducer';

export { ALICE, LAIN };

/** A feed with no posting default. */
export const MAIN: FeedSpec = { id: 'f1', name: 'main', sources: [] };

/** A feed that posts as lain. */
export const OTHER: FeedSpec = { id: 'f2', name: 'other', sources: [], postAs: LAIN.key };

/** A running session: `/postas` runs against its current state, which it moves. */
type Desk = {
  readonly state: () => AppState;
  readonly printed: readonly string[];
  readonly run: (args: string) => Promise<CommandOutcome>;
};

/** The action that opens the feed window of {@link feed}. */
export function openFeed(feed: FeedSpec): AppAction {
  return { type: 'windows', action: feedWindowOpen(feed) };
}

/** The action that opens the window of lain's home timeline. */
export const OPEN_HOME: AppAction = {
  type: 'windows',
  action: {
    type: 'open',
    ref: { kind: 'home', accountKey: LAIN.key, target: null },
    title: 'home',
  },
};

/** A session with {@link feeds} saved, {@link postAs} chosen and {@link actions} done. */
export function desk(
  feeds: Feeds,
  postAs: string | null,
  actions: readonly AppAction[] = [],
): Desk {
  const printed: string[] = [];
  let state = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN, ALICE],
    activeKey: LAIN.key,
  });
  const dispatch = (action: AppAction): void => {
    state = appReducer(state, action);
  };
  dispatch({ type: 'settings', settings: { feeds, postAs } });
  for (const action of actions) {
    dispatch(action);
  }
  const { stores } = fakeCommandContext();
  for (const account of [LAIN, ALICE]) {
    stores.accounts.add(account);
  }
  return {
    state: () => state,
    printed,
    run: async (args) =>
      await command.run(
        args,
        fakeCommandContext({
          state,
          windows: state.windows,
          stores,
          dispatch,
          print: (text) => {
            printed.push(text);
          },
        }),
      ),
  };
}
