/**
 * The quoted words a notification sentence carries (see ./notificationText):
 * a status's or a message's content flattened to one plain line by the shared
 * {@link plainText}, trimmed to {@link EXCERPT_LIMIT} characters with `…` for
 * the cut. Pure; the content is hostile remote markup and never leaves here
 * as anything but text.
 */

import { plainText } from './quoteView';
import type { Status } from '../api/schemas/status';

/** The most characters of a status's words an excerpt shows; `…` marks a cut. */
const EXCERPT_LIMIT = 60;

/** The `parts` joined by single spaces, the empty and absent ones dropped. */
export function join(parts: readonly (string | null)[]): string {
  return parts.filter((part) => part !== null && part !== '').join(' ');
}

/** `text` quoted, cut to {@link EXCERPT_LIMIT} characters. */
function quoted(text: string): string {
  return `"${text.length > EXCERPT_LIMIT ? `${text.slice(0, EXCERPT_LIMIT)}…` : text}"`;
}

/** What a post with no words shows instead: its attachments counted, or nothing said. */
function wordless(status: Status | null): string {
  const files = status?.media_attachments.length ?? 0;
  if (files === 0) {
    return '(no text)';
  }
  return `(${String(files)} attachment${files === 1 ? '' : 's'})`;
}

/**
 * The words of `source` as one quoted excerpt: a status's content or a plain
 * HTML string. With `exact`, an empty one stays `""` (a favourite names its
 * post as it is); without, it reads `(no text)` or the media summary, so the
 * line never ends bare. No status at all gives nothing.
 */
export function excerpt(source: Status | string | null, exact = false): string | null {
  if (source === null) {
    return exact ? '""' : null;
  }
  const text = plainText(typeof source === 'string' ? source : source.content);
  if (text !== '' || exact) {
    return quoted(text);
  }
  return wordless(typeof source === 'string' ? null : source);
}

/** Whether `status` has any words of its own, once its markup is flattened. */
export function hasWords(status: Status): boolean {
  return plainText(status.content) !== '';
}
