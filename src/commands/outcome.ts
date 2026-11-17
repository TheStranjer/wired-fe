/**
 * The shared command-result builders (decision 6, AGENTS.md "One command
 * registry"): the failure every handler returns and the refusal every
 * command answers with when nobody is signed in. They live in one place so
 * every path turns the reader down with the same shape and the same words.
 */

import type { CommandOutcome } from './types';
import { NOT_LOGGED_IN_MESSAGE } from '../lib/refusal';

/** A failure saying {@link message}. */
export function fail(message: string): CommandOutcome {
  return { ok: false, message };
}

/** The refusal every command answers with when nobody is signed in. */
export const NOT_LOGGED_IN: CommandOutcome = { ok: false, message: NOT_LOGGED_IN_MESSAGE };
