/**
 * The labelled posts of a window's scrollback, as the label completions of
 * the command line (./labelProvider, WFE-301) and of the post text boxes
 * (./postLabelProvider, WFE-302) read them: every post a line still shows
 * together with the label its window gave it, newest line first, and the one
 * line of plain text that says which post it is: `<@author> first words`,
 * a content warning in place of the body and a `⟲` in front of a boost.
 */

import { plainText } from './quoteView';
import type { Status } from '../api/schemas/status';
import type { Buffer } from '../state/buffer';
import { shownQuote } from '../state/bufferPosts';
import { labelForStatus, statusOfLine } from '../state/bufferSelection';

/** The most characters of a post's words a description shows; `…` marks a cut. */
const WORDS_LIMIT = 40;

/** A bracketed label word while it is typed: `[`, `[a`, `[a3`, `[a3]`. */
export const BRACKET_WORD = /^\[[a-z]*[0-9]?\]?$/iu;

/** One labelled post of the scrollback. */
export type Labelled = {
  readonly label: string;
  readonly status: Status;
};

/** The statuses a line of {@link status} can be named by: itself, then the quote under it. */
function shownOn(status: Status): readonly Status[] {
  const quote = shownQuote(status);
  return quote === null ? [status] : [status, quote];
}

/**
 * The labelled posts of {@link buffer}, newest line first: for each line that
 * still carries a status, the status and the quote it shows, once per label.
 */
export function labelledIn(buffer: Buffer): readonly Labelled[] {
  const found = new Map<string, Labelled>();
  for (const line of buffer.lines.toReversed()) {
    const status = statusOfLine(line);
    for (const shown of status === null ? [] : shownOn(status)) {
      const label = labelForStatus(buffer, shown.id);
      if (label !== null && !found.has(label)) {
        found.set(label, { label, status: shown });
      }
    }
  }
  return [...found.values()];
}

/** {@link text} on one line, cut to {@link WORDS_LIMIT} characters with `…`. */
function clipped(text: string): string {
  const flat = text.replace(/\s+/gu, ' ').trim();
  return flat.length > WORDS_LIMIT ? `${flat.slice(0, WORDS_LIMIT)}…` : flat;
}

/** What a post says: its content warning in place of the body, else the body as plain text. */
function saying(status: Status): string {
  return status.spoiler_text === '' ? plainText(status.content) : `CW: ${status.spoiler_text}`;
}

/** `<@author> words` for {@link status}, with `⟲` in front for a boost, whose author is the original's. */
export function postWords(status: Status): string {
  const original = status.reblog ?? status;
  const marker = status.reblog === null ? '' : '⟲ ';
  return `${marker}<@${original.account.acct}> ${clipped(saying(original))}`.trim();
}

/** The label word {@link word} is the start of: no bracket, no closing one, lowercase. */
export function prefixOf(word: string): string {
  return word.replace(/^\[/u, '').replace(/\]$/u, '').toLowerCase();
}
