/**
 * The search endpoint: `GET /api/v2/search` answers one document holding the
 * three resource lists the query `q` matched — accounts, statuses and
 * hashtags (decision 7). Wired, Mastodon and Pleroma all serve it; the shared
 * entity schemas normalize their shapes onto one model and a list missing
 * from the answer reads as empty. `resolve=true` asks the instance to look a
 * `user@host` mention up over WebFinger and to fetch a pasted remote URL
 * (WBE-192, WBE-172); {@link shouldResolve} says when a query looks worth
 * that. `type` narrows the document to one resource list and `limit` sizes
 * each of them; both ride only when set. The document itself is not paged,
 * so the answer is the body, unwrapped by {@link sessionRequestData}.
 */
import * as v from 'valibot';

import type { Result } from '../../lib/result';
import type { ApiError } from '../errors';
import { type Account, AccountSchema } from '../schemas/account';
import { type Status, StatusSchema } from '../schemas/status';
import { type Tag, TagSchema } from '../schemas/tag';
import { type ApiSession, sessionRequestData } from '../session';
import type { QueryValue } from '../url';

/** The one resource list {@link search} can narrow its answer to. */
export type SearchType = 'accounts' | 'statuses' | 'hashtags';

/** The combined-search document: the three lists, a missing one empty. */
export type SearchResults = {
  readonly accounts: readonly Account[];
  readonly statuses: readonly Status[];
  readonly hashtags: readonly Tag[];
};

/** The document body: every list optional, an absent one answered empty. */
const SearchResultsSchema: v.GenericSchema<unknown, SearchResults> = v.object({
  accounts: v.optional(v.array(AccountSchema), []),
  statuses: v.optional(v.array(StatusSchema), []),
  hashtags: v.optional(v.array(TagSchema), []),
});

/** What {@link search} asks for besides the session and the query: remote
 * resolution, one resource to fill, and a page size. */
export type SearchOptions = {
  /** True sends `resolve=true`; false or undefined omits the parameter. */
  readonly resolve?: boolean;
  /** Set sends `type` and the answer fills only that list. */
  readonly type?: SearchType;
  /** Set sends `limit`; the server's own default sizes the lists without it. */
  readonly limit?: number;
};

/** The search query: `q` always, each optional parameter only when set. */
function searchQuery(query: string, options: SearchOptions): Record<string, QueryValue> {
  const params: Record<string, QueryValue> = { q: query };
  if (options.resolve === true) {
    params['resolve'] = true;
  }
  if (options.type !== undefined) {
    params['type'] = options.type;
  }
  if (options.limit !== undefined) {
    params['limit'] = options.limit;
  }
  return params;
}

/** A query that is exactly `user@host`, with the optional leading `@`. */
const ACCT_PATTERN = /^@?[\w.~-]+@[\w.-]+$/;

/** A query that opens with an http(s) URL. */
const URL_PATTERN = /^https?:\/\//i;

/**
 * True when {@link query} looks like a remote reference — `@user@host`,
 * `user@host` or an http(s) URL — rather than plain search text: worth
 * sending with `resolve: true` so the instance fetches it from its home
 * server. Surrounding whitespace is ignored; words, `#tag`s and everything
 * else are not.
 */
export function shouldResolve(query: string): boolean {
  const text = query.trim();
  return URL_PATTERN.test(text) || ACCT_PATTERN.test(text);
}

/**
 * Runs one v2 combined search for {@link query} on {@link session}'s
 * instance: `options.resolve` asks for remote resolution (see
 * {@link shouldResolve}), `options.type` fills a single list and
 * `options.limit` sizes them. The answer is the normalized
 * {@link SearchResults}; any failure is the typed {@link ApiError}
 * `apiRequest` produced. {@link signal} can cancel the request, which
 * answers the `aborted` error; the optional signal rides a rest tuple so
 * callers still pass the four arguments this interface fixes.
 */
export async function search(
  session: ApiSession,
  query: string,
  ...[options, signal]: [options: SearchOptions, signal?: AbortSignal]
): Promise<Result<SearchResults, ApiError>> {
  return sessionRequestData(session, {
    path: '/api/v2/search',
    query: searchQuery(query, options),
    schema: SearchResultsSchema,
    ...(signal === undefined ? {} : { signal }),
  });
}
