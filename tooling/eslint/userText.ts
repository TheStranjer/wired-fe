/**
 * What counts as user-facing text for the `wired/no-literal-user-text` rule
 * (AGENTS.md "Linting"): the pure string tests behind it. A string is only
 * flagged when it holds a word (two letters in a row); glyphs, punctuation and a
 * lone letter like the `x` of `[x]` are not text. Key chords are allowed
 * anywhere. In a command's `usage` a string that is only command syntax is
 * allowed too.
 */

import { USER_TEXT_ALLOWLIST } from './userTextAllowlist.ts';

const WORD = /\p{L}{2}/u;
const MODIFIER_CHORD = /^(?:(?:Ctrl|Alt|Shift|Meta|Cmd|Super)\+)+\S+$/u;
const SINGLE_CHARACTER = /^.$/u;
const COMMAND_NAME = /^\/[a-z][a-z0-9-]*$/u;
const SUBCOMMAND_WORD = /^[a-z][a-z0-9-]*$/u;
const PLACEHOLDER = /<[^<>]*>|\[[^[\]]*\]/gu;

/** The most literal subcommand words a usage may hold; more is prose. */
const MAX_LITERAL_WORDS = 2;

/** True when {@link text} holds a word: two letters in a row, in any script. A lone letter (`[x]`) is a glyph. */
export function hasWord(text: string): boolean {
  return WORD.test(text);
}

/** True when {@link token} is a chord with modifiers, like `Ctrl+B` or `Alt+Shift+K`. */
function isModifierChord(token: string): boolean {
  return MODIFIER_CHORD.test(token);
}

/**
 * True when {@link text} is a key chord or a sequence of them: at least one
 * `Ctrl+B`-style chord, and every other token a single character (`Ctrl+B %`).
 */
export function isKeyChord(text: string): boolean {
  const tokens = text.trim().split(/\s+/u);
  return (
    tokens.some(isModifierChord) &&
    tokens.every((token) => isModifierChord(token) || SINGLE_CHARACTER.test(token))
  );
}

/** {@link text} with every `<…>` and `[…]` placeholder, nested ones included, blanked out. */
function withoutPlaceholders(text: string): string {
  const blanked = text.replace(PLACEHOLDER, ' ');
  return blanked === text ? text : withoutPlaceholders(blanked);
}

/** The literal subcommand words of an `a|b|c` token, or `undefined` when it is not one. */
function alternatives(token: string): readonly string[] | undefined {
  const parts = token.split('|').filter((part) => part !== '');
  const valid = parts.length > 0 && parts.every((part) => SUBCOMMAND_WORD.test(part));
  return valid ? parts : undefined;
}

/**
 * True when {@link text} is only command syntax: a leading `/name`, then
 * `<…>` and `[…]` placeholders, `|`, `...` and at most a couple of literal
 * subcommand words (`/win move <from> <to>`).
 */
export function isCommandSyntax(text: string): boolean {
  const [first, ...rest] = withoutPlaceholders(text).trim().split(/\s+/u);
  if (first === undefined || !COMMAND_NAME.test(first)) {
    return false;
  }
  const words = rest.filter(
    (token) => token !== '|' && token !== '...' && !COMMAND_NAME.test(token),
  );
  const parts = words.map(alternatives);
  return parts.every((found) => found !== undefined) && parts.flat().length <= MAX_LITERAL_WORDS;
}

/** True when the allowlist excuses {@link text} in the file at {@link filename}. */
export function isAllowlisted(filename: string, text: string): boolean {
  const path = filename.replaceAll('\\', '/');
  return USER_TEXT_ALLOWLIST.some(
    (entry) => entry.text === text && (path === entry.file || path.endsWith(`/${entry.file}`)),
  );
}
