/**
 * What the commands that open a window share (decisions 6 and 13). Placement:
 * every one of them accepts a trailing `--in <here|vsplit|split|float|hidden>`,
 * and {@link placedRun} makes that so for a definition's run in one place —
 * it cuts the flag off the arguments and hands the command a context whose
 * window opens are placed by `--in`, else the per-kind setting, else the
 * default (src/state/placement), so no command spells placement itself. The
 * account-window commands (`/home`, `/local`, `/federated`, `/notifications`)
 * open a window of the active account, or refuse when nobody is signed in;
 * each says only which window it opens.
 */

import { NOT_LOGGED_IN, OK, contextRun, fail } from './outcome';
import type { CommandContext, CommandDefinition } from './types';
import type { StoredAccount } from '../accounts/accountStore';
import { type Result, err, ok } from '../lib/result';
import {
  type OpenAction,
  PLACEMENTS,
  type Placement,
  isPlacement,
  resolvePlacement,
} from '../state/placement';
import { activeAccount } from '../state/selectors';
import type { WindowsAction } from '../windows/reducer';

/** A trailing `--in` and the word after it, if there is one. */
const TRAILING_IN = /(?:^|\s)--in(?:\s+(\S+))?\s*$/u;

/** The arguments without their trailing `--in`, and the placement it asked for, if any. */
export type Placed = { readonly rest: string; readonly placement: Placement | null };

/** The words `--in` takes, for the message that refuses another. */
const IN_WORDS = PLACEMENTS.join('|');

/**
 * Cuts a trailing `--in <placement>` off {@link args}: the rest is untouched
 * and the placement null when there is none. A `--in` with no placement or an
 * unknown one is an error that lists the words.
 */
export function splitPlacement(args: string): Result<Placed, string> {
  const found = TRAILING_IN.exec(args);
  if (found === null) {
    return ok({ rest: args, placement: null });
  }
  const word = found[1]?.toLowerCase();
  if (word === undefined || !isPlacement(word)) {
    return err(`--in takes ${IN_WORDS}`);
  }
  return ok({ rest: args.slice(0, found.index).trimEnd(), placement: word });
}

/** Opens {@link action} where {@link override}, else its kind's setting, else the default says; `here` is the plain open. */
function placeOpen(context: CommandContext, action: OpenAction, override: Placement | null): void {
  const placement = resolvePlacement(context.state.settings, action.ref.kind, override);
  if (placement === 'here') {
    context.dispatchWindows(action);
  } else {
    context.dispatch({ type: 'openPlaced', action, placement });
  }
}

/** {@link context} with the window opens placed as {@link override}, the kind's setting or the default say. */
function placing(context: CommandContext, override: Placement | null): CommandContext {
  if (context.placedByCaller === true) {
    return context;
  }
  return {
    ...context,
    dispatchWindows: (action: WindowsAction) => {
      if (action.type === 'open') {
        placeOpen(context, action, override);
      } else {
        context.dispatchWindows(action);
      }
    },
  };
}

/**
 * {@link run} as a command that takes `--in <placement>` (decision 13): the
 * flag is cut off the arguments and the windows the run opens are placed as
 * it, the kind's setting or the default say.
 */
export function placedRun(run: CommandDefinition['run']): CommandDefinition['run'] {
  return async (args, context) => {
    const placed = splitPlacement(args);
    if (!placed.ok) {
      return fail(placed.error);
    }
    return await run(placed.value.rest, placing(context, placed.value.placement));
  };
}

/**
 * A command's run that dispatches {@link open}'s transition for the active
 * account, titled against the active account key, and refuses with the
 * not-logged-in message when there is no account. Other arguments are ignored;
 * `--in` places the window.
 */
export function accountWindowRun(
  open: (account: StoredAccount, activeKey: string | null) => WindowsAction,
): CommandDefinition['run'] {
  return placedRun(
    contextRun((context: CommandContext) => {
      const account = activeAccount(context.state);
      if (account === null) {
        return NOT_LOGGED_IN;
      }
      context.dispatchWindows(open(account, context.state.activeAccountKey));
      return OK;
    }),
  );
}
