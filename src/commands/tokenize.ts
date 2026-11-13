/**
 * Tokenizer for the argument text a command receives after its name
 * (decision 6): whitespace-separated tokens where `"`-quoted sections let a
 * token carry spaces, e.g. `/cw "spoilers for lain" text`. Pure parsing only;
 * command lookup and argument grammars live elsewhere.
 */

import { type Result, err, ok } from '../lib/result';

/** A quoted section opened at {@link position} is never closed. */
export type TokenizeError = {
  readonly kind: 'unterminated-quote';
  readonly position: number;
};

/** One scanned token and the index in the input where reading continues. */
type Scanned = { readonly text: string; readonly next: number };

const WHITESPACE = /\s/;

/** An escape pair inside a quoted section: `\"` or `\\`. */
const ESCAPE = /^\\(["\\])/;

/**
 * Read the quoted section that starts at the `"` on index {@link start},
 * turning `\"` into `"` and `\\` into `\`; any other backslash stays as it
 * is, together with the character after it.
 */
function readQuoted(input: string, start: number): Result<Scanned, TokenizeError> {
  const parts: string[] = [];
  let i = start + 1;
  let ch = input.slice(i, i + 1);
  while (ch !== '' && ch !== '"') {
    if (ESCAPE.test(input.slice(i, i + 2))) {
      parts.push(input.slice(i + 1, i + 2));
      i += 2;
    } else {
      parts.push(ch);
      i += 1;
    }
    ch = input.slice(i, i + 1);
  }
  if (ch !== '"') {
    return err({ kind: 'unterminated-quote', position: start });
  }
  return ok({ text: parts.join(''), next: i + 1 });
}

/**
 * Read one token starting at {@link start} (which holds no whitespace): runs
 * of plain characters and quoted sections join into the same token; it ends
 * at the next whitespace outside a quoted section.
 */
function readToken(input: string, start: number): Result<Scanned, TokenizeError> {
  const parts: string[] = [];
  let i = start;
  while (i < input.length) {
    const ch = input.slice(i, i + 1);
    if (ch === '"') {
      const quoted = readQuoted(input, i);
      if (!quoted.ok) {
        return quoted;
      }
      parts.push(quoted.value.text);
      i = quoted.value.next;
    } else if (WHITESPACE.test(ch)) {
      break;
    } else {
      parts.push(ch);
      i += 1;
    }
  }
  return ok({ text: parts.join(''), next: i });
}

/**
 * Split command argument text into tokens. Tokens are separated by runs of
 * whitespace; `""` yields an empty token. Backslashes outside quoted
 * sections are literal. Reports {@link TokenizeError} for a quote that is
 * never closed.
 */
export function tokenize(input: string): Result<readonly string[], TokenizeError> {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    if (WHITESPACE.test(input.slice(i, i + 1))) {
      i += 1;
    } else {
      const scanned = readToken(input, i);
      if (!scanned.ok) {
        return scanned;
      }
      tokens.push(scanned.value.text);
      i = scanned.value.next;
    }
  }
  return ok(tokens);
}
