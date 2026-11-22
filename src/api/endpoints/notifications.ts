/**
 * The notification endpoints: `GET /api/v1/notifications` answers one page of
 * the session's notifications, narrowed by the repeated `types[]` and
 * `exclude_types[]` parameters, `POST /api/v1/notifications/<id>/dismiss`
 * dismisses one of them, and `POST /api/v1/notifications/clear` dismisses
 * them all. Wired, Mastodon and Pleroma all serve the three; the shared
 * {@link NotificationSchema} normalizes their shapes onto one model
 * (decision 7). The list pages with cursors: the request carries
 * {@link pageQuery}'s parameters and the response's `Link` header is wrapped
 * by {@link toPage} into a {@link Page}. Dismiss and clear answer `ok(null)`
 * whatever body their 2xx carries; the dismissed id is percent-encoded into
 * one path segment.
 */
import * as v from 'valibot';

import type { Result } from '../../lib/result';
import type { ApiError } from '../errors';
import { type Page, type PageRequest, pageQuery } from '../page';
import { NothingSchema } from '../response';
import { type Notification, NotificationSchema } from '../schemas/notification';
import { type ApiSession, sessionRequestData, sessionRequestPage } from '../session';
import type { QueryValue } from '../url';

/** The list body: an array of notifications. */
const NotificationListSchema: v.GenericSchema<unknown, readonly Notification[]> =
  v.array(NotificationSchema);

/** What {@link listNotifications} asks for besides the session: a page, and
 * the two type filters. */
type NotificationOptions = {
  /** The page to fetch; omitted when undefined. */
  readonly page?: PageRequest;
  /** Non-empty sends the types as repeated `types[]`; empty omits them. */
  readonly types?: readonly string[];
  /** Non-empty sends them as repeated `exclude_types[]`; empty omits them. */
  readonly excludeTypes?: readonly string[];
};

/** The notifications query: {@link pageQuery}'s page parameters, plus each
 * type filter only when its array actually has entries in it. */
function notificationsQuery(options: NotificationOptions): Record<string, QueryValue> {
  const query: Record<string, QueryValue> = { ...pageQuery(options.page) };
  if (options.types !== undefined && options.types.length > 0) {
    query['types'] = options.types;
  }
  if (options.excludeTypes !== undefined && options.excludeTypes.length > 0) {
    query['exclude_types'] = options.excludeTypes;
  }
  return query;
}

/**
 * One page of {@link session}'s notifications, newest first: `options.page`
 * picks the page, and `options.types` and `options.excludeTypes` filter by
 * notification type when non-empty, each as its own repeated `[]` parameter.
 * The answer's `Link` header is wrapped by {@link toPage}. {@link signal} can
 * cancel the request, which answers the `aborted` error.
 */
export async function listNotifications(
  session: ApiSession,
  options: NotificationOptions,
  signal?: AbortSignal,
): Promise<Result<Page<Notification>, ApiError>> {
  return sessionRequestPage(session, {
    path: '/api/v1/notifications',
    query: notificationsQuery(options),
    schema: NotificationListSchema,
    signal,
  });
}

/**
 * Dismisses notification {@link id} of {@link session}'s instance: one POST
 * to `/api/v1/notifications/<id>/dismiss` with the id percent-encoded into one
 * path segment and an empty body. Any 2xx answer becomes `ok(null)`; any
 * failure is the typed {@link ApiError} `apiRequest` produced.
 */
export async function dismissNotification(
  session: ApiSession,
  id: string,
): Promise<Result<null, ApiError>> {
  return sessionRequestData(session, {
    path: `/api/v1/notifications/${encodeURIComponent(id)}/dismiss`,
    method: 'POST',
    schema: NothingSchema,
  });
}

/**
 * Dismisses every notification of {@link session}'s account: one POST to
 * `/api/v1/notifications/clear` with an empty body. The answer is `ok(null)`
 * whatever the 2xx body holds; any failure is passed through unchanged.
 */
export async function clearNotifications(session: ApiSession): Promise<Result<null, ApiError>> {
  return sessionRequestData(session, {
    path: '/api/v1/notifications/clear',
    method: 'POST',
    schema: NothingSchema,
  });
}
