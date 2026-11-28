/**
 * The account read endpoints: `GET /api/v1/accounts/verify_credentials` for
 * the session's own account, `.../accounts/<id>` for any one account,
 * `.../lookup?acct=<acct>` to find an account by name (and, for a remote
 * name the instance has not stored yet, a resolving search: see
 * {@link findAccountByHandle}), `.../<id>/statuses`
 * for a page of its posts, and `.../relationships?id[]=<id>` for how the
 * session stands to a set of accounts. Wired, Mastodon and Pleroma all serve
 * these; the shared schemas normalize their shapes onto one model
 * (decision 7) and drop extras such as Mastodon's `source` block. Ids are
 * percent-encoded path segments; the optional signal rides a rest tuple so
 * callers still pass the four arguments these interfaces fix.
 */
import * as v from 'valibot';

import { search } from './search';
import { type Result, ok } from '../../lib/result';
import type { ApiError } from '../errors';
import { type Page, type PageRequest, pageQuery } from '../page';
import { type Account, AccountSchema } from '../schemas/account';
import { type Relationship, RelationshipSchema } from '../schemas/relationship';
import { type Status, StatusListSchema } from '../schemas/status';
import { type ApiSession, sessionRequestData, sessionRequestPage } from '../session';
import type { QueryValue } from '../url';

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
    signal,
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
    signal,
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
    signal,
  });
}

/** True when {@link error} is an HTTP 404 answer. */
function isNotFound(error: ApiError): boolean {
  return error.kind === 'http' && error.status === 404;
}

/** True when {@link account} is the one named {@link name}, by `acct` or `fqn`, in any case. */
function isNamed(account: Account, name: string): boolean {
  return [account.acct, account.fqn].some((own) => own?.toLowerCase() === name);
}

/**
 * The account named by {@link handle} (see {@link lookupAccount}), found even
 * when the instance has never stored it: a lookup that fails with HTTP 404 for
 * a `user@host` handle falls back to a resolving account search, and the first
 * result whose `acct` or `fqn` equals the handle (any case) is the answer. No
 * exact match answers the original 404, and any other lookup error is answered
 * unchanged. A session with no token never searches: backends refuse
 * anonymous resolution. {@link signal} can cancel the requests, which answers
 * the `aborted` error.
 */
export async function findAccountByHandle(
  session: ApiSession,
  handle: string,
  signal?: AbortSignal,
): Promise<Result<Account, ApiError>> {
  const found = await lookupAccount(session, handle, signal);
  const name = handle.startsWith('@') ? handle.slice(1) : handle;
  if (found.ok || !isNotFound(found.error) || !name.includes('@') || session.token === null) {
    return found;
  }
  const options = { resolve: true, type: 'accounts', limit: 5 } as const;
  const searched = await search(session, name, options, signal);
  const lower = name.toLowerCase();
  const match = searched.ok ? searched.value.accounts.find((a) => isNamed(a, lower)) : undefined;
  return match === undefined ? found : ok(match);
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
  return sessionRequestPage(session, {
    path: `/api/v1/accounts/${encodeURIComponent(id)}/statuses`,
    query: statusesQuery(options),
    schema: StatusListSchema,
    signal,
  });
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
    signal,
  });
}
