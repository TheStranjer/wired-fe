/**
 * What the fake instances answer to an edit (WFE-268), the same on every
 * backend: `GET /api/v1/statuses/:id/source` gives the plain text and warning
 * behind a fixture status, and `PUT /api/v1/statuses/:id` answers the status
 * with the new text and an `edited_at`, as Mastodon-compatible servers do.
 */

import { escapeHtml, type Json } from './wire';

/** The plain text of {@link html}: its tags dropped, which is all the fixture posts need. */
function plainText(html: string): string {
  return html.replaceAll(/<[^>]*>/gu, '');
}

/** The source document of the fixture status {@link found}. */
export function sourceOf(found: Json): Json {
  const { id, content, spoiler_text: warning } = found;
  return {
    id,
    text: plainText(typeof content === 'string' ? content : ''),
    spoiler_text: typeof warning === 'string' ? warning : '',
  };
}

/** The fixture status {@link found} as the instance answers once its text is {@link text}. */
export function editedStatus(found: Json, text: string): Json {
  return {
    ...found,
    content: `<p>${escapeHtml(text)}</p>`,
    edited_at: new Date().toISOString(),
  };
}
