/**
 * The account read endpoints: `GET /api/v1/accounts/verify_credentials` for
 * the session's own account, `.../accounts/<id>` for any one account,
 * `.../lookup?acct=<acct>` to find an account by name, `.../<id>/statuses`
 * for a page of its posts, and `.../relationships?id[]=<id>` for how the
 * session stands to a set of accounts. Wired, Mastodon and Pleroma all serve
 * these; the shared schemas normalize their shapes onto one model
 * (decision 7) and drop extras such as Mastodon's `source` block. Ids are
 * percent-encoded path segments; the optional signal rides a rest tuple so
 * callers still pass the four arguments these interfaces fix.
 */
import * as v from 'valibot';

import { type Result, ok } from '../../lib/result';
import type { ApiError } from '../errors';
import { type Page, type PageRequest, pageQuery, toPage } from '../page';
import { type Account, AccountSchema } from '../schemas/account';
import { type Relationship, RelationshipSchema } from '../schemas/relationship';
import { type Status, StatusSchema } from '../schemas/status';
import { type ApiSession, sessionRequest, sessionRequestData } from '../session';
import type { QueryValue } from '../url';

/** The statuses list body: an array of posts. */
const StatusListSchema: v.GenericSchema<unknown, readonly Status[]> = v.array(StatusSchema);

/** The relationships list body: an array of states, one per requested id. */
const RelationshipListSchema: v.GenericSchema<unknown, readonly Relationship[]> =
  v.array(RelationshipSchema);

/** What {@link accountStatuses} asks for besides the account: a page, and filters. */
type StatusesOptions = {
  /** The page to fetch; omitted when undefined. */
  readonly page?: PageRequest;
  /** True sends `exclude_replies=true`; false or undefined omits the parameter. */
  readonly excludeReplies?: boolean;
  /** True sends `pinned=true`; false or undefined omits the parameter. */
  readonly pinned?: boolean;
};

/** The account of {@link session}: the user its token belongs to. Mastodon's
 * extra `source` block is dropped by the schema. {@link signal} can cancel
 * the request, which answers the `aborted` error. */
export async function verifyCredentials(
  session: ApiSession,
  signal?: AbortSignal,
): Promise<Result<Account, ApiError>> {
  return sessionRequestData(session, {
    path: '/api/v1/accounts/verify_credentials',
    schema: AccountSchema,
    ...(signal === undefined ? {} : { signal }),
  });
}

/** One account by {@link id}, percent-encoded into the path. {@link signal}
 * can cancel the request, which answers the `aborted` error. */
export async function getAccount(
  session: ApiSession,
  id: string,
  signal?: AbortSignal,
): Promise<Result<Account, ApiError>> {
  return sessionRequestData(session, {
    path: `/api/v1/accounts/${encodeURIComponent(id)}`,
    schema: AccountSchema,
    ...(signal === undefined ? {} : { signal }),
  });
}

/** The account named by {@link acct}: `user` for a local one, `user@host`
 * for a remote one; a leading `@` is removed. {@link signal} can cancel the
 * request, which answers the `aborted` error. */
export async function lookupAccount(
  session: ApiSession,
  acct: string,
  signal?: AbortSignal,
): Promise<Result<Account, ApiError>> {
  const name = acct.startsWith('@') ? acct.slice(1) : acct;
  return sessionRequestData(session, {
    path: '/api/v1/accounts/lookup',
    query: { acct: name },
    schema: AccountSchema,
    ...(signal === undefined ? {} : { signal }),
  });
}

/** The statuses query: {@link pageQuery}'s page parameters, plus each filter
 * only when it is explicitly true. */
function statusesQuery(options: StatusesOptions): Record<string, QueryValue> {
  const query: Record<string, QueryValue> = { ...pageQuery(options.page) };
  if (options.excludeReplies === true) {
    query['exclude_replies'] = true;
  }
  if (options.pinned === true) {
    query['pinned'] = true;
  }
  return query;
}

/** One page of the posts of account {@link id}, newest first: `options.page`
 * picks the page, and `options.excludeReplies` and `options.pinned` narrow
 * the list only when set to true. The answer's `Link` header is wrapped by
 * {@link toPage}. {@link signal} can cancel the request, which answers the
 * `aborted` error. */
export async function accountStatuses(
  session: ApiSession,
  id: string,
  ...[options, signal]: [options: StatusesOptions, signal?: AbortSignal]
): Promise<Result<Page<Status>, ApiError>> {
  const response = await sessionRequest(session, {
    path: `/api/v1/accounts/${encodeURIComponent(id)}/statuses`,
    query: statusesQuery(options),
    schema: StatusListSchema,
    ...(signal === undefined ? {} : { signal }),
  });
  return response.ok ? ok(toPage(response.value)) : response;
}

/** How {@link session}'s account stands to each of {@link ids}: one
 * {@link Relationship} per id, in the server's order. No ids asked is no
 * request sent — just an empty list. {@link signal} can cancel the request,
 * which answers the `aborted` error. */
export async function relationships(
  session: ApiSession,
  ids: readonly string[],
  signal?: AbortSignal,
): Promise<Result<readonly Relationship[], ApiError>> {
  if (ids.length === 0) {
    return ok([]);
  }
  return sessionRequestData(session, {
    path: '/api/v1/accounts/relationships',
    query: { id: ids },
    schema: RelationshipListSchema,
    ...(signal === undefined ? {} : { signal }),
  });
}
