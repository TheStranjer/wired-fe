/**
 * What each feed source reads (decision 14): one page of one source, fetched as
 * one account through the endpoint the matching window already uses — the home,
 * local, federated and hashtag timelines, the notification list (narrowed to
 * mentions for `mentions`) and, for `dms`, the last word of each conversation —
 * and tagged as feed items for the merge engine. Failures pass through as the
 * endpoint's own {@link ApiError}.
 */

import { listConversations } from '../../api/endpoints/conversations';
import { listNotifications } from '../../api/endpoints/notifications';
import { homeTimeline, publicTimeline, tagTimeline } from '../../api/endpoints/timelines';
import type { ApiError } from '../../api/errors';
import type { Page, PageRequest } from '../../api/page';
import type { Conversation } from '../../api/schemas/conversation';
import type { Notification } from '../../api/schemas/notification';
import type { Status } from '../../api/schemas/status';
import type { ApiSession } from '../../api/session';
import { type Result, ok } from '../../lib/result';
import { type FeedItem, notificationItem, postItem } from '../../state/feedItem';
import type { FeedSource, FeedSourceRef } from '../../state/feeds';

/** One page of a source as feed items. */
export type SourcePage = Result<Page<FeedItem>, ApiError>;

/** What a page request needs besides the source: who asks, which page, and a way to cancel. */
export type Ask = {
  readonly session: ApiSession;
  readonly page: PageRequest;
  readonly signal: AbortSignal;
};

/** The sources that take no argument. */
type PlainSource = Exclude<FeedSource, `tag:${string}`>;

/** How one source is read as one account. */
type Fetcher = (ref: FeedSourceRef, ask: Ask) => Promise<SourcePage>;

/** {@link result} with its items turned into feed items; a failure unchanged. */
function mapPage<T>(
  result: Result<Page<T>, ApiError>,
  toItems: (items: readonly T[]) => FeedItem[],
): SourcePage {
  return result.ok ? ok({ items: toItems(result.value.items), links: result.value.links }) : result;
}

/** Statuses as post items fetched by {@link ref}. */
function posts(ref: FeedSourceRef): (statuses: readonly Status[]) => FeedItem[] {
  return (statuses) => statuses.map((status) => postItem(status, ref));
}

/** Notifications as notification items fetched by {@link ref}. */
function notifications(ref: FeedSourceRef): (list: readonly Notification[]) => FeedItem[] {
  return (list) => list.map((one) => notificationItem(one, ref));
}

/** Conversations as the post items of their last words fetched by {@link ref}; empty ones are left out. */
function lastWords(ref: FeedSourceRef): (list: readonly Conversation[]) => FeedItem[] {
  return (list) =>
    list.flatMap((one) => (one.last_status === null ? [] : [postItem(one.last_status, ref)]));
}

/** Every source that takes no argument, by name. */
const PLAIN_SOURCES: Record<PlainSource, Fetcher> = {
  home: async (ref, ask) =>
    mapPage(await homeTimeline(ask.session, ask.page, ask.signal), posts(ref)),
  local: async (ref, ask) =>
    mapPage(
      await publicTimeline(ask.session, { local: true, page: ask.page }, ask.signal),
      posts(ref),
    ),
  federated: async (ref, ask) =>
    mapPage(
      await publicTimeline(ask.session, { local: false, page: ask.page }, ask.signal),
      posts(ref),
    ),
  mentions: async (ref, ask) =>
    mapPage(
      await listNotifications(ask.session, { page: ask.page, types: ['mention'] }, ask.signal),
      notifications(ref),
    ),
  notifications: async (ref, ask) =>
    mapPage(
      await listNotifications(ask.session, { page: ask.page }, ask.signal),
      notifications(ref),
    ),
  dms: async (ref, ask) =>
    mapPage(await listConversations(ask.session, ask.page, ask.signal), lastWords(ref)),
};

/** Whether {@link source} is a hashtag, `tag:<name>`. */
function isTag(source: FeedSource): source is `tag:${string}` {
  return source.startsWith('tag:');
}

/** One page of the source {@link ref} names, as feed items fetched by its account. */
export async function fetchSourcePage(ref: FeedSourceRef, ask: Ask): Promise<SourcePage> {
  const { source } = ref;
  if (isTag(source)) {
    const name = source.slice('tag:'.length);
    return mapPage(await tagTimeline(ask.session, name, ask.page, ask.signal), posts(ref));
  }
  return await PLAIN_SOURCES[source](ref, ask);
}
