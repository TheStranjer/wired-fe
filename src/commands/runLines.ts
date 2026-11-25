/**
 * Running several command lines in a row and reporting how it went (decision
 * 6): the way a window with a GUI does what the command line does, so command,
 * click and settings stay one path. Each line is looked up in the registry and
 * run as the dispatcher would, but the outcome comes back instead of being
 * printed, and the first refusal stops the rest. A command reads the state it
 * was handed, so the lines after one that changed the app see that change: the
 * state they read is moved along by every action an earlier line dispatched.
 */

import { OK, fail } from './outcome';
import { parseInput } from './parseInput';
import { lookupCommand } from './registry';
import type { CommandContext, CommandOutcome } from './types';
import { type AppAction, appReducer } from '../state/reducer';

/** The message of a thrown value, however unfriendly the throw was. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Run one command line as {@link context}; text, an unknown command and a throw are refusals. */
async function runLine(line: string, context: CommandContext): Promise<CommandOutcome> {
  const parsed = parseInput(line);
  if (parsed.kind !== 'command') {
    return fail(`Not a command: ${line}`);
  }
  const definition = lookupCommand(context.registry, parsed.name);
  if (definition === undefined) {
    return fail(`Unknown command: /${parsed.name}`);
  }
  try {
    return await definition.run(parsed.rest, context);
  } catch (error) {
    return fail(`Command failed: ${errorMessage(error)}`);
  }
}

/**
 * Run {@link lines} one after another as {@link context}; resolves to the
 * first refusal, with the lines after it left unrun, or to success.
 */
export async function runLines(
  lines: readonly string[],
  context: CommandContext,
): Promise<CommandOutcome> {
  let state = context.state;
  const dispatch = (action: AppAction): void => {
    state = appReducer(state, action);
    context.dispatch(action);
  };
  for (const line of lines) {
    const outcome = await runLine(line, { ...context, state, dispatch });
    if (!outcome.ok) {
      return outcome;
    }
  }
  return OK;
}
