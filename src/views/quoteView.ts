/**
 * The quote under a post (WFE-99): the quoted status mapped onto the plain
 * data QuoteBlock draws — the window label it was given, the author's two
 * handle forms and a one-line excerpt. The excerpt is the quote's content as
 * plain text, its whitespace collapsed and trimmed to {@link EXCERPT_LIMIT}
 * characters with an ellipsis; a quote behind a content warning shows the
 * warning instead of the words, the way the row shows its own.
 */

import { fullHandle } from '../accounts/handle';
import type { Status } from '../api/schemas/status';
import { sanitizeRemoteHtml } from '../ui/sanitize';

/** What a window answers when asked which label it gave a status id. */
export type LabelOf = (statusId: string) => string | null;

/** The nick's two handle forms: the short one the scrollback prints and the
 * @-prefixed full one for titles and accessible names. */
export type Handles = {
  readonly handle: string;
  readonly fullHandle: string;
};

/** The quoted post under its quoter, as ui/QuoteBlock draws it. */
export type QuoteView = {
  /** The label the window gave the quoted status, so commands can name it. */
  readonly label: string | null;
  /** Who wrote the quoted post: the nick's two handle forms. */
  readonly author: Handles;
  /** The quoted content as one line of plain text, or `[CW: …]`. */
  readonly excerpt: string;
};

/** The most characters a quote excerpt shows; the ellipsis tells it was cut. */
const EXCERPT_LIMIT = 120;

/** One run of any whitespace, collapsed out of the excerpt. */
const WHITESPACE_RUN = /\s+/gu;

/**
 * Remote markup as single-line plain text: through the one sanitizer first, so
 * the words inside forbidden elements never reach the excerpt, then a detached
 * DOMParser parse resolves the tags and entities, and whitespace collapses.
 * Shared by quote excerpts and notification lines (the same hostile content).
 */
export function plainText(html: string): string {
  const safe = sanitizeRemoteHtml(html);
  const { body } = new DOMParser().parseFromString(safe, 'text/html');
  return body.textContent.replace(WHITESPACE_RUN, ' ').trim();
}

/** `text` trimmed to {@link EXCERPT_LIMIT} characters, `…` marking the cut. */
function trimmed(text: string): string {
  return text.length > EXCERPT_LIMIT ? `${text.slice(0, EXCERPT_LIMIT)}…` : text;
}

/** What the excerpt line says: the warning where there is one, else the content. */
export function excerptOf(quote: Status): string {
  if (quote.spoiler_text !== '') {
    return `[CW: ${quote.spoiler_text}]`;
  }
  return trimmed(plainText(quote.content));
}

/**
 * Map a quoted status onto its excerpt line seen from `origin`, labelled by
 * `labelOf`; null when the post quotes nothing.
 */
export function quoteView(
  quote: Status | null,
  origin: string,
  labelOf: LabelOf,
): QuoteView | null {
  if (quote === null) {
    return null;
  }
  return {
    label: labelOf(quote.id),
    author: { handle: quote.account.acct, fullHandle: `@${fullHandle(quote.account, origin)}` },
    excerpt: excerptOf(quote),
  };
}
