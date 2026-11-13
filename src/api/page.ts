/**
 * The paginated list response: {@link toPage} wraps a successful
 * `ApiResponse` of items into a {@link Page} by parsing its `Link` header
 * (./pagination), and {@link pageQuery} turns a page request back into the
 * query parameters that fetch it again.
 */
import { type PageCursor, type PageLinks, parseLinkHeader } from './pagination';
import type { ApiResponse } from './response';

/** One page of a list: its items and the cursors of the neighbouring pages. */
export type Page<T> = {
  readonly items: readonly T[];
  readonly links: PageLinks;
};

/** What to ask for a page: a cursor from {@link Page.links}, and a limit. */
export type PageRequest = {
  /** One direction's cursor, taken from `page.links.next` or `.prev`. */
  readonly cursor?: PageCursor;
  /** Maximum number of items to return. */
  readonly limit?: number;
};

/**
 * The query parameters for a page request: the cursor's parameters plus
 * `limit`. An explicit `limit` overrides one the cursor carries.
 */
export function pageQuery(
  request: PageRequest | undefined,
): Readonly<Record<string, string | number | undefined>> {
  if (request === undefined) {
    return {};
  }
  return {
    ...request.cursor,
    ...(request.limit === undefined ? {} : { limit: request.limit }),
  };
}

/** Wraps a successful list response into a {@link Page} using its Link header. */
export function toPage<T>(response: ApiResponse<readonly T[]>): Page<T> {
  return { items: response.data, links: parseLinkHeader(response.link) };
}
