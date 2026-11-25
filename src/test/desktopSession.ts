/**
 * A running app for command tests that need the real reducer under them
 * (AGENTS.md "Testing"): a command context whose `dispatch` feeds the app
 * reducer, so a `/desktop` or `/mvd` line changes real windows and layout,
 * and whose `print` is collected. Each run rebuilds the context from the state
 * as it is, the way the shell does.
 */
import { fakeCommandContext } from './commandContext';
import type { CommandDefinition, CommandOutcome } from '../commands/types';
import { type AppState, initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import type { AppAction } from '../state/reducer';

/** What a test drives and reads. */
export type DesktopSession = {
  /** Run {@link command} with {@link args} over the current state. */
  readonly run: (command: CommandDefinition, args: string) => Promise<CommandOutcome>;
  /** Apply an action to the app state directly, as a click or key would. */
  readonly apply: (action: AppAction) => void;
  /** The app state now. */
  readonly state: () => AppState;
  /** Every line printed so far, oldest first. */
  readonly printed: readonly string[];
};

/** A fresh session: one window, one desktop, one pane. */
export function desktopSession(): DesktopSession {
  let state = initialAppState();
  const printed: string[] = [];
  const apply = (action: AppAction): void => {
    state = appReducer(state, action);
  };
  return {
    run: async (command, args) =>
      await command.run(
        args,
        fakeCommandContext({
          state,
          windows: state.windows,
          dispatch: apply,
          print: (text) => {
            printed.push(text);
          },
        }),
      ),
    apply,
    state: () => state,
    printed,
  };
}
