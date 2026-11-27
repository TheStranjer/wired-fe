/**
 * Hash routes (decision 4): the permalinks WiredFE serves from the address
 * bar, as a string-literal-discriminated union with a parser and a formatter
 * that are each other's inverse. `#/notice/<id>` is a post, `#/@<user>` and
 * `#/@<user>@<host>` an account by name, `#/users/<id>` an account by id,
 * and `#/tag/<name>` a hashtag; every route carries the one decoded segment
 * as its `value`. Every segment is percent-encoded on the way out and decoded
 * on the way in; anything else, an empty segment or an extra segment
 * included, is not a route. `#/authorize_interaction?uri=<v>` (also `acct=<v>`,
 * the old template's name) is a remote follow or interaction link: its value
 * is the account handle (a leading `acct:` stripped) or URL to resolve, kept
 * raw. In a build that may talk to several instances a notice, user or tag
 * is qualified with its instance: `#/<host>/notice/<id>`, `#/<host>/users/<id>`
 * and `#/<host>/tag/<name>`, `<host>` being the origin's host, port included,
 * its scheme implied (`https:`, `http:` for a local hostname). A host segment
 * must contain a dot or be `localhost`, so `#/@user` and the box routes never
 * read as qualified. Pure: nothing here reads the address bar. Two more hashes open boxes,
 * not windows, and have their own parsers: `#/registration/<token>` (the invite)
 * and `#/password_reset/<token>` (the reset letter).
 */

import { hostOfOrigin, originOfHost } from './origin';

/**
 * One place the address bar can point at. A notice, user or tag may carry the
 * `origin` of the instance its id belongs to (the qualified form); without
 * one it is opened by the active account.
 */
export type Route =
  | { readonly kind: 'notice'; readonly value: string; readonly origin?: string }
  | { readonly kind: 'acct'; readonly value: string }
  | { readonly kind: 'user'; readonly value: string; readonly origin?: string }
  | { readonly kind: 'tag'; readonly value: string; readonly origin?: string }
  | { readonly kind: 'interact'; readonly value: string };

/** A hash route: a keyword and its slash, or an `@`, then one segment. */
const ROUTE = /^#\/(notice\/|users\/|tag\/|@)([^/]+)$/u;

/** A qualified route: a host segment, a keyword and its slash, then one segment. */
const QUALIFIED = /^#\/([^/@?]+)\/(notice\/|users\/|tag\/)([^/]+)$/u;

/** A remote-interaction route: its keyword, then a leading, non-empty `uri` or `acct` parameter. */
const INTERACT = /^#\/authorize_interaction(\?)(?:uri|acct)=([^&]+)/u;

/** The kind each head {@link ROUTE} or {@link INTERACT} captures opens. */
const HEADS: Readonly<Record<string, Route['kind'] | undefined>> = {
  'notice/': 'notice',
  'users/': 'user',
  'tag/': 'tag',
  '@': 'acct',
  '?': 'interact',
};

/** What each segment-carrying kind's segment follows in the hash. */
const PREFIX: Readonly<Record<Exclude<Route['kind'], 'interact'>, string>> = {
  notice: 'notice/',
  acct: '@',
  user: 'users/',
  tag: 'tag/',
};

/** {@link segment} decoded (none is empty), or null when its percent-escapes are malformed. */
function decode(segment = ''): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** The kind a qualified route's keyword {@link head} opens. */
function qualifiedKind(head: string): 'notice' | 'user' | 'tag' {
  if (head === 'notice/') {
    return 'notice';
  }
  return head === 'tag/' ? 'tag' : 'user';
}

/**
 * The qualified route {@link hash} spells (`#/<host>/notice/<id>` and its
 * `users` and `tag` kin), or null when it is not one: no keyword, a segment
 * that is not a host (see `originOfHost`), or a malformed escape.
 */
function parseQualified(hash: string): Route | null {
  const [, host = '', head = '', segment = ''] = QUALIFIED.exec(hash) ?? [];
  const origin = originOfHost(host);
  const value = decode(segment);
  return origin === null || value === null ? null : { kind: qualifiedKind(head), value, origin };
}

/** The unqualified route {@link hash} spells, or null when it is not one. */
function parseShort(hash: string): Route | null {
  const [, head = '', segment] = ROUTE.exec(hash) ?? INTERACT.exec(hash) ?? [];
  const value = decode(segment)?.replace(/^acct:/u, '');
  const kind = HEADS[head];
  return value === undefined || value === '' || kind === undefined ? null : { kind, value };
}

/**
 * The route {@link hash} spells (`window.location.hash`, leading `#` and
 * all), or null when it is empty, junk, lacks its id, or has extra segments.
 * A leading `acct:` is dropped from the value, which only an interaction
 * link's handle carries.
 */
export function parseRoute(hash: string): Route | null {
  return parseQualified(hash) ?? parseShort(hash);
}

/** The origin a qualified {@link route} names; undefined for any other route. */
export function routeOrigin(route: Route): string | undefined {
  return 'origin' in route ? route.origin : undefined;
}

/** The hash (leading `#` included) that {@link route} is spelled as. */
export function formatRoute(route: Route): string {
  const { kind, value } = route;
  if (kind === 'interact') {
    return `#/authorize_interaction?uri=${encodeURIComponent(value)}`;
  }
  const origin = routeOrigin(route);
  const host = origin === undefined ? '' : `${hostOfOrigin(origin)}/`;
  return `#/${host}${PREFIX[kind]}${encodeURIComponent(value).replaceAll('%40', '@')}`;
}

/** An invite-link route: its keyword, then one token segment, then an optional query that is ignored. */
const REGISTRATION = /^#\/registration\/([^/?]+)(?:\?.*)?$/u;

/**
 * The invite token of the `#/registration/<token>` route {@link hash} spells,
 * decoded, or null when it is anything else. It is no {@link Route}: it opens
 * the sign-up box, not a window, so it has its own parser.
 */
export function parseRegistrationRoute(hash: string): string | null {
  const [, segment] = REGISTRATION.exec(hash) ?? [];
  const token = decode(segment);
  return token === null || token === '' ? null : token;
}

/** A reset-letter route: its keyword, then one token segment, then an optional query that is ignored. */
const PASSWORD_RESET = /^#\/password_reset\/([^/?]+)(?:\?.*)?$/u;

/**
 * The reset token of the `#/password_reset/<token>` route {@link hash} spells,
 * decoded, or null when it is anything else. Like the invite route it is no
 * {@link Route}: it opens the new-password box, not a window.
 */
export function parsePasswordResetRoute(hash: string): string | null {
  const [, segment] = PASSWORD_RESET.exec(hash) ?? [];
  const token = decode(segment);
  return token === null || token === '' ? null : token;
}
