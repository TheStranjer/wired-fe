/**
 * Classifier for raw command-line input: post text or run a command
 * (AGENTS.md "The command line is the composer"). Pure parsing only;
 * argument grammars and registry lookup live elsewhere (decision 6).
 */

/** A command name once lowercased: a letter, then letters, digits, hyphens. */
const COMMAND_NAME = /^[a-z][a-z0-9-]*$/;

/** How one line of command-line input was classified. */
export type ParsedInput =
  | { readonly kind: 'empty' }
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'command'; readonly name: string; readonly rest: string }
  | { readonly kind: 'invalid'; readonly reason: string };

/**
 * Classify what the user typed at the command line.
 *
 * - Blank input is empty.
 * - `//text` is the literal text `/text`; other text is returned as typed.
 * - `/name args` is a command: `name` is lowercased, `args` stay unparsed.
 * - `/` without a valid name is invalid, with a human-readable reason.
 */
export function parseInput(input: string): ParsedInput {
  if (input.trim() === '') {
    return { kind: 'empty' };
  }
  if (input.startsWith('//')) {
    return { kind: 'text', text: input.slice(1) };
  }
  if (!input.startsWith('/')) {
    return { kind: 'text', text: input };
  }
  const body = input.slice(1);
  const [typedName = ''] = body.split(/\s/);
  if (typedName === '') {
    return { kind: 'invalid', reason: 'Missing command name after /' };
  }
  const name = typedName.toLowerCase();
  if (!COMMAND_NAME.test(name)) {
    return { kind: 'invalid', reason: `Invalid command name: /${typedName}` };
  }
  return { kind: 'command', name, rest: body.slice(typedName.length).trimStart() };
}
