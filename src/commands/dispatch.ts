/**
 * The command dispatcher (decision 6): the one function the command line
 * calls on Enter and the keymap calls with a bound command line. parseInput
 * classifies the input, plain text goes to the app's text handler and a
 * command runs through the registry. Every failure is printed into the
 * active window as an error; nothing escapes as an exception.
 */

import { unavailableRefusal } from './available';
import { parseInput } from './parseInput';
import { lookupCommand } from './registry';
import type { CommandContext, CommandOutcome } from './types';

/** What plain text does in the active window (post, reply, DM…). Supplied by the app. */
export type TextHandler = (text: string) => Promise<void>;

/** The message of a thrown value, however unfriendly the throw was. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Print what a command reported as its failure; a successful outcome prints nothing. */
function reportOutcome(outcome: CommandOutcome, context: CommandContext): void {
  if (!outcome.ok) {
    context.print(outcome.message, 'error');
  }
}

/**
 * Look the command up and run it. An unknown name, a command the active
 * account's backend cannot do (WFE-172) and a throw are printed, not rethrown.
 */
async function runCommand(name: string, rest: string, context: CommandContext): Promise<void> {
  const definition = lookupCommand(context.registry, name);
  if (definition === undefined) {
    const refusal = unavailableRefusal(context, name);
    context.print(refusal ?? `Unknown command: /${name}. Try /help`, 'error');
    return;
  }
  try {
    reportOutcome(await definition.run(rest, context), context);
  } catch (error) {
    context.print(`Command failed: ${errorMessage(error)}`, 'error');
  }
}

/** Hand the text to the app. A rejecting handler is printed, not rethrown. */
async function sendText(text: string, context: CommandContext, onText: TextHandler): Promise<void> {
  try {
    await onText(text);
  } catch (error) {
    context.print(`Failed: ${errorMessage(error)}`, 'error');
  }
}

/**
 * Do what one line of command-line input asks: post the text, run the
 * command, or print the reason neither was possible. Always resolves.
 */
export async function dispatchInput(
  input: string,
  context: CommandContext,
  onText: TextHandler,
): Promise<void> {
  const parsed = parseInput(input);
  switch (parsed.kind) {
    case 'empty':
      return;
    case 'invalid':
      context.print(parsed.reason, 'error');
      return;
    case 'text':
      await sendText(parsed.text, context, onText);
      return;
    case 'command':
      await runCommand(parsed.name, parsed.rest, context);
      return;
  }
}
