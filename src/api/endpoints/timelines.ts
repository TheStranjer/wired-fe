/**
 * The timeline endpoints: `GET /api/v1/timelines/home`, `.../public` (the
 * local or the federated public timeline) and `.../tag/<tag>`. Wired,
 * Mastodon and Pleroma all serve them, and the shared {@link StatusSchema}
 * normalizes their posts onto one model (decision 7). Each pages with
 * cursors: the request carries {@link pageQuery}'s parameters and the
 * response's `Link` header is wrapped by {@link toPage} into a {@link Page}.
 */
import * as v from 'valibot';

import { type Result, ok } from '../../lib/result';
import type { ApiError } from '../errors';
import { type Page, type PageRequest, pageQuery, toPage } from '../page';
import { type Status, StatusSchema } from '../schemas/status';
import { type ApiSession, sessionRequest } from '../session';
import type { QueryValue } from '../url';

/** The list body all three timelines answer: an array of posts. */
const StatusListSchema: v.GenericSchema<unknown, readonly Status[]> = v.array(StatusSchema);

/** What {@link publicTimeline} asks for besides a session: which public
 * timeline, and which page of it. */
type PublicOptions = {
  /** True sends `local: true`; false omits the parameter entirely. */
  readonly local: boolean;
  /** The page to fetch; omitted when undefined. */
  readonly page?: PageRequest;
};

/**
 * Fetch one page of statuses from {@link path} and wrap it into a
 * {@link Page}; every failure passes through unchanged. The optional signal
 * rides a rest tuple: four plain parameters would break the 3-parameter
 * limit while callers still pass the four arguments these interfaces fix.
 */
async function getTimeline(
  session: ApiSession,
  path: string,
  ...[query, signal]: [query: Readonly<Record<string, QueryValue>>, signal?: AbortSignal]
): Promise<Result<Page<Status>, ApiError>> {
  const response = await sessionRequest(session, {
    path,
    query,
    schema: StatusListSchema,
    ...(signal === undefined ? {} : { signal }),
  });
  return response.ok ? ok(toPage(response.value)) : response;
}

/**
 * One page of {@link session}'s home timeline — the posts of the accounts it
 * follows. {@link page} picks the page; {@link signal} can cancel the
 * request, which answers the `aborted` error.
 */
export async function homeTimeline(
  session: ApiSession,
  page?: PageRequest,
  signal?: AbortSignal,
): Promise<Result<Page<Status>, ApiError>> {
  return getTimeline(session, '/api/v1/timelines/home', pageQuery(page), signal);
}

/**
 * One page of {@link session}'s public timeline: `options.local` narrows it
 * to the instance's own posts, and without it the timeline federates.
 * {@link signal} can cancel the request, which answers the `aborted` error.
 */
export async function publicTimeline(
  session: ApiSession,
  options: PublicOptions,
  signal?: AbortSignal,
): Promise<Result<Page<Status>, ApiError>> {
  const query: Record<string, QueryValue> = { ...pageQuery(options.page) };
  if (options.local) {
    query['local'] = true;
  }
  return getTimeline(session, '/api/v1/timelines/public', query, signal);
}

/**
 * One page of the hashtag timeline for {@link tag}: a leading `#` is removed
 * and the name is percent-encoded, so `#Lain` and `Lain` both ask for
 * `/api/v1/timelines/tag/Lain`. {@link page} picks the page; {@link signal}
 * can cancel the request, which answers the `aborted` error.
 */
export async function tagTimeline(
  session: ApiSession,
  tag: string,
  ...[page, signal]: [page?: PageRequest, signal?: AbortSignal]
): Promise<Result<Page<Status>, ApiError>> {
  const name = tag.startsWith('#') ? tag.slice(1) : tag;
  return getTimeline(
    session,
    `/api/v1/timelines/tag/${encodeURIComponent(name)}`,
    pageQuery(page),
    signal,
  );
}
