/**
 * What the commands that open a window share (decisions 6 and 13). Placement:
 * every one of them accepts a trailing `--in <here|vsplit|split|float|hidden>`,
 * and {@link placedRun} makes that so for a definition's run in one place —
 * it cuts the flag off the arguments and hands the command a context whose
 * window opens are placed by `--in`, else the per-kind setting, else the
 * default (src/state/placement), so no command spells placement itself. The
 * account-window commands (`/home`, `/local`, `/federated`, `/notifications`)
 * open a window of the active account, or refuse when nobody is signed in;
 * each says only which window it opens, and whether text after it is posted
 * there.
 */

import { NOT_LOGGED_IN, OK, fail } from './outcome';
import { postIntoWindow } from './postIntoWindow';
import type { CommandContext, CommandDefinition } from './types';
import type { StoredAccount } from '../accounts/accountStore';
import { type Result, err, ok } from '../lib/result';
import {
  type OpenAction,
  PLACEMENTS,
  type Placement,
  isPlacement,
  resolvePlacement,
  resolveReplyPlacement,
} from '../state/placement';
import { activeAccount } from '../state/selectors';
import { windowId } from '../windows/model';
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

/** Opens {@link action} as {@link placement} says; `here` is the plain open. */
function openAs(context: CommandContext, action: OpenAction, placement: Placement): void {
  if (placement === 'here') {
    context.dispatchWindows(action);
  } else {
    context.dispatch({ type: 'openPlaced', action, placement });
  }
}

/** Opens {@link action} where {@link override}, else its kind's setting, else the default says. */
function placeOpen(context: CommandContext, action: OpenAction, override: Placement | null): void {
  openAs(context, action, resolvePlacement(context.state.settings, action.ref.kind, override));
}

/**
 * Opens the reply composer {@link action} where {@link override}, else the
 * `composer` kind's setting, else `replyIn` says (WFE-244); a caller that
 * places the window itself gets the plain open.
 */
export function openReplyWindow(
  context: CommandContext,
  action: OpenAction,
  override: Placement | null,
): void {
  if (context.placedByCaller === true) {
    context.dispatchWindows(action);
    return;
  }
  openAs(context, action, resolveReplyPlacement(context.state.settings, override));
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

/** What an account-window command does besides opening its window. */
export type AccountWindowOptions = {
  /** Whether text after the command is posted into the opened window (WFE-279). */
  readonly postsText: boolean;
};

/**
 * A command's run that dispatches {@link open}'s transition for the active
 * account, titled against the active account key, and refuses with the
 * not-logged-in message when there is no account. `--in` places the window.
 * With {@link options}' `postsText` the arguments left after `--in` are
 * posted as that account into the opened window, as typing them there would;
 * otherwise they are ignored.
 */
export function accountWindowRun(
  open: (account: StoredAccount, activeKey: string | null) => OpenAction,
  options: AccountWindowOptions = { postsText: false },
): CommandDefinition['run'] {
  return placedRun(async (args, context) => {
    const account = activeAccount(context.state);
    if (account === null) {
      return NOT_LOGGED_IN;
    }
    const action = open(account, context.state.activeAccountKey);
    context.dispatchWindows(action);
    const text = args.trim();
    if (!options.postsText || text === '') {
      return OK;
    }
    return await postIntoWindow(
      context,
      { accountKey: account.key, windowId: windowId(action.ref) },
      text,
    );
  });
}
