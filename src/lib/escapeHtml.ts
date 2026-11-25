/**
 * Turns plain text into HTML text content: the five characters that mean
 * something in markup become entities, so the result renders as exactly the
 * text it came from. Used to hand a plain display name to the sanitizing
 * component, which is the only place HTML is ever rendered.
 */

/** The text with `& < > " '` replaced by their entities. */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
