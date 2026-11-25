/**
 * Shared test helpers for the split commands (decisions 12 and 13): a running
 * session over the real app reducer in which `/vsplit`, `/split` and the real
 * open commands move the state, plus readers for the panes it ends up with.
 */
import { fakeCommandContext } from './commandContext';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { command as home } from '../commands/defs/home';
import { command as query } from '../commands/defs/query';
import { command as tag } from '../commands/defs/tag';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../commands/types';
import { type AppState, initialAppState } from '../state/appState';
import { type AppAction, appReducer } from '../state/reducer';
import { activeDesktop } from '../windows/desktops';
import { windowId } from '../windows/model';
import { panes } from '../windows/splitTree';

const ORIGIN = 'https://wired.example';

/** A signed-in account of {@link ORIGIN}. */
function accountOf(id: string, handle: string): StoredAccount {
  return {
    key: accountKey(ORIGIN, id),
    origin: ORIGIN,
    accountId: id,
    handle,
    token: 'never-logged',
    refreshToken: null,
    expiresAt: null,
  };
}

/** The first account of a session. */
export const LAIN = accountOf('1', 'lain@wired.example');

/** A second account of a session. */
export const ALICE = accountOf('2', 'alice@wired.example');

/** The window id of the hashtag view of {@link account}. */
export function tagId(account: StoredAccount, name: string): string {
  return windowId({ kind: 'hashtag', accountKey: account.key, target: name });
}

/** A definition that asks for what {@link ask} says and answers {@link outcome}. */
export function stub(
  name: string,
  outcome: CommandOutcome,
  ask: (args: string, dispatchWindows: CommandContext['dispatchWindows']) => void = () => undefined,
): CommandDefinition {
  return {
    name,
    usage: `/${name}`,
    summary: name,
    run: async (args, context) => {
      ask(args, context.dispatchWindows);
      return await Promise.resolve(outcome);
    },
  };
}

/** A running session: the commands run against its current state, which they move. */
export type Desk = {
  readonly state: () => AppState;
  readonly run: (command: CommandDefinition, args: string) => Promise<CommandOutcome>;
};

/** A session signed in as {@link accounts} (the last one active) with {@link extra} commands open to the splits. */
export function desk(
  accounts: readonly StoredAccount[],
  extra: readonly CommandDefinition[] = [],
): Desk {
  const definitions = [home, tag, query, ...extra];
  const registry = {
    commands: definitions,
    byName: new Map(definitions.map((definition) => [definition.name, definition])),
  };
  let state = appReducer(initialAppState(), {
    type: 'accounts',
    accounts,
    activeKey: accounts.at(-1)?.key ?? null,
  });
  const dispatch = (action: AppAction): void => {
    state = appReducer(state, action);
  };
  return {
    state: () => state,
    run: async (command, args) =>
      await command.run(
        args,
        fakeCommandContext({
          state,
          windows: state.windows,
          registry,
          dispatch,
          dispatchWindows: (action) => {
            dispatch({ type: 'windows', action });
          },
        }),
      ),
  };
}

/** The windows the panes of the active desktop show, in tree order. */
export function shown(state: AppState): readonly string[] {
  const { tree } = activeDesktop(state.layout);
  return tree === null ? [] : panes(tree).map((pane) => pane.windowId);
}

/** The direction of the root split of the active desktop; `pane` for a single pane or none. */
export function direction(state: AppState): string {
  const { tree } = activeDesktop(state.layout);
  return tree?.type === 'split' ? tree.dir : 'pane';
}
