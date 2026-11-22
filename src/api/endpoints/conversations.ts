/**
 * The conversation endpoints: `GET /api/v1/conversations` answers one page of
 * the direct-message threads the session's account takes part in, newest
 * activity first, and `POST /api/v1/conversations/<id>/read` flags one of them
 * read and answers the entity as the server now sees it. Wired, Mastodon and
 * Pleroma all serve both; the shared {@link ConversationSchema} normalizes
 * their shapes onto one model (decision 7), participants and last status
 * included. The list pages with cursors: the request carries
 * {@link pageQuery}'s parameters and the response's `Link` header is wrapped
 * by {@link toPage} into a {@link Page}. The mark's id is percent-encoded into
 * one path segment, and a repeat mark answers the same conversation.
 */
import * as v from 'valibot';

import type { Result } from '../../lib/result';
import type { ApiError } from '../errors';
import { type Page, type PageRequest, pageQuery } from '../page';
import { type Conversation, ConversationSchema } from '../schemas/conversation';
import { type ApiSession, sessionRequestData, sessionRequestPage } from '../session';

/** The list body: an array of conversations. */
const ConversationListSchema: v.GenericSchema<unknown, readonly Conversation[]> =
  v.array(ConversationSchema);

/**
 * One page of {@link session}'s direct-message conversations. {@link page}
 * picks the page; {@link signal} can cancel the request, which answers the
 * `aborted` error.
 */
export async function listConversations(
  session: ApiSession,
  page?: PageRequest,
  signal?: AbortSignal,
): Promise<Result<Page<Conversation>, ApiError>> {
  return sessionRequestPage(session, {
    path: '/api/v1/conversations',
    query: pageQuery(page),
    schema: ConversationListSchema,
    signal,
  });
}

/**
 * Marks conversation {@link id} of {@link session}'s instance read: one POST
 * to `/api/v1/conversations/<id>/read` with the id percent-encoded into one
 * path segment and an empty body. The answer is that conversation, its
 * `unread` flag cleared; any failure is the typed {@link ApiError}
 * `apiRequest` produced — Wired answers an unknown id (and one belonging to
 * somebody else) with the same 404.
 */
export async function markConversationRead(
  session: ApiSession,
  id: string,
): Promise<Result<Conversation, ApiError>> {
  return sessionRequestData(session, {
    path: `/api/v1/conversations/${encodeURIComponent(id)}/read`,
    method: 'POST',
    schema: ConversationSchema,
  });
}
