/**
 * The status source endpoint: `GET /api/v1/statuses/<id>/source` answers the
 * plain text behind one post — exactly what an edit sends back, not the HTML
 * the timeline renders. Only the author may read it: Wired answers a
 * stranger's request with the 403 the delete and the edit use for the same
 * refusal, and every backend's answer comes back through {@link StatusSource}
 * (decision 7). The shapes differ at the edges, so the schema requires `id`
 * and `text`, defaults `spoiler_text` to the empty string where a backend
 * leaves it out, and drops everything else — Wired's `content_type` key
 * included, since WiredFE edits in one plain-text dialect anyway.
 */
import * as v from 'valibot';

import type { Result } from '../../lib/result';
import type { ApiError } from '../errors';
import { type ApiSession, sessionRequestData } from '../session';

/** The source text of a status, as its author wrote it. */
export type StatusSource = {
  readonly id: string;
  readonly text: string;
  readonly spoiler_text: string;
};

/** The source answer: `spoiler_text` defaults to `''`, unknown keys dropped. */
const StatusSourceSchema: v.GenericSchema<unknown, StatusSource> = v.object({
  id: v.string(),
  text: v.string(),
  spoiler_text: v.optional(v.string(), ''),
});

/**
 * The source text of status {@link id} of {@link session}'s instance: one GET
 * to `/api/v1/statuses/<id>/source` with the id percent-encoded into one path
 * segment. Any failure is the typed {@link ApiError} `apiRequest` produced.
 */
export async function getStatusSource(
  session: ApiSession,
  id: string,
): Promise<Result<StatusSource, ApiError>> {
  return sessionRequestData(session, {
    path: `/api/v1/statuses/${encodeURIComponent(id)}/source`,
    schema: StatusSourceSchema,
  });
}
