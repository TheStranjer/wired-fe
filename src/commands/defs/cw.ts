/**
 * `/cw <warning> <text>` (decision 6): post through the active window behind a
 * content warning. The warning is the first token of the argument text, read the
 * way {@link tokenize} reads it, so it may be quoted (`/cw "lain spoilers" she
 * is everywhere`); the text is the rest of the original string, as typed, its
 * inner spacing kept. Either one missing prints the usage. The draft goes to
 * {@link CommandContext.post}: the active window's kind decides what it means,
 * and an error string from it comes back as the command's failure.
 */

import { t } from '../../i18n/translate';
import { fail, postOutcome } from '../outcome';
import { tokenize } from '../tokenize';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** Every argument is refused with this line: the warning or the text is missing. */
function usageError(): CommandOutcome {
  return fail(t('commands.defs.cw.usage_error'));
}

/** Whitespace between tokens, as src/commands/tokenize.ts reads it. */
const WHITESPACE = /\s/;

/** An escape pair inside a quoted section: `\"` or `\\`, as the tokenizer reads it. */
const ESCAPE = /^\\(["\\])/;

/**
 * The index just past the quoted section that opens on the `"` at {@link start},
 * mirroring the tokenizer's {@link ESCAPE} handling. Only strings whose first
 * token tokenized are ever scanned, so the closing quote is certain to be found.
 */
function pastQuoted(input: string, start: number): number {
  let i = start + 1;
  while (input.slice(i, i + 1) !== '"') {
    i += ESCAPE.test(input.slice(i, i + 2)) ? 2 : 1;
  }
  return i + 1;
}

/**
 * The index in {@link input} just past its first token, which starts at 0:
 * plain characters and quoted sections join into it, and it ends at the first
 * whitespace outside a quoted section or at the end of the string — the
 * tokenizer's own reading, kept raw so the text behind it can be sliced off
 * exactly as typed.
 */
function pastFirstToken(input: string): number {
  let i = 0;
  while (i < input.length) {
    const ch = input.slice(i, i + 1);
    if (ch === '"') {
      i = pastQuoted(input, i);
    } else if (WHITESPACE.test(ch)) {
      break;
    } else {
      i += 1;
    }
  }
  return i;
}

/** The settled split: the {@link warning} shown over the post {@link text}. */
type Split = { readonly warning: string; readonly text: string };

/**
 * The warning and the text {@link args} holds: the trimmed argument text's
 * first token — quoted, so `""` may carry spaces — and the raw remainder of the
 * string after it, trimmed at both ends. A missing warning, an empty one, an
 * unterminated quote or a missing text reads as no warning at all.
 */
function splitWarning(args: string): Split {
  const rest = args.trimStart();
  const tokens = tokenize(rest);
  const warning = tokens.ok ? (tokens.value[0] ?? '') : '';
  const text = warning === '' ? '' : rest.slice(pastFirstToken(rest)).trim();
  return { warning, text };
}

/** Read the warning and the text, then post the draft behind the warning. */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const { warning, text } = splitWarning(args);
  if (warning === '' || text === '') {
    return usageError();
  }
  return postOutcome(await context.post({ text, spoilerText: warning }));
}

/** The `/cw` definition. */
export const command: CommandDefinition = {
  name: 'cw',
  get usage(): string {
    return t('commands.defs.cw.usage');
  },
  get summary(): string {
    return t('commands.defs.cw.summary');
  },
  run: handle,
};
