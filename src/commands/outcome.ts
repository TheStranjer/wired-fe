/**
 * The shared command-result builders and run wrappers (decision 6, AGENTS.md
 * "One command registry"): the failure every handler returns, the refusal
 * every command answers with when nobody is signed in, and the two wrappers
 * that lift a synchronous handler into a command definition — so a command
 * whose answer is immediate says so once, not once per definition file. They
 * live in one place so every path turns the reader down with the same shape
 * and the same words.
 */

import type { CommandContext, CommandDefinition, CommandOutcome } from './types';
import { NOT_LOGGED_IN_MESSAGE } from '../lib/refusal';

/** A failure saying {@link message}. */
export function fail(message: string): CommandOutcome {
  return { ok: false, message };
}

/** The success every command that has nothing to add answers with. */
export const OK: CommandOutcome = { ok: true };

/** The refusal every command answers with when nobody is signed in. */
export const NOT_LOGGED_IN: CommandOutcome = { ok: false, message: NOT_LOGGED_IN_MESSAGE };

/** {@link handle} as a command's run: the answer is immediate; the run resolves it. */
export function syncRun(
  handle: (args: string, context: CommandContext) => CommandOutcome,
): CommandDefinition['run'] {
  return async (args, context) => await Promise.resolve(handle(args, context));
}

/** A context-only {@link handle} as a command's run: the answer is immediate; the run resolves it. */
export function contextRun(
  handle: (context: CommandContext) => CommandOutcome,
): CommandDefinition['run'] {
  return async (_args, context) => await Promise.resolve(handle(context));
}
