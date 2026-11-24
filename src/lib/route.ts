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
 * raw. Pure: nothing here reads the address bar. Two more hashes open boxes,
 * not windows, and have their own parsers: `#/registration/<token>` (the invite)
 * and `#/password_reset/<token>` (the reset letter).
 */

/** One place the address bar can point at. */
export type Route =
  | { readonly kind: 'notice'; readonly value: string }
  | { readonly kind: 'acct'; readonly value: string }
  | { readonly kind: 'user'; readonly value: string }
  | { readonly kind: 'tag'; readonly value: string }
  | { readonly kind: 'interact'; readonly value: string };

/** A hash route: a keyword and its slash, or an `@`, then one segment. */
const ROUTE = /^#\/(notice\/|users\/|tag\/|@)([^/]+)$/u;

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

/**
 * The route {@link hash} spells (`window.location.hash`, leading `#` and
 * all), or null when it is empty, junk, lacks its id, or has extra segments.
 * A leading `acct:` is dropped from the value, which only an interaction
 * link's handle carries.
 */
export function parseRoute(hash: string): Route | null {
  const [, head = '', segment] = ROUTE.exec(hash) ?? INTERACT.exec(hash) ?? [];
  const value = decode(segment)?.replace(/^acct:/u, '');
  const kind = HEADS[head];
  return value === undefined || value === '' || kind === undefined ? null : { kind, value };
}

/** The hash (leading `#` included) that {@link route} is spelled as. */
export function formatRoute({ kind, value }: Route): string {
  if (kind === 'interact') {
    return `#/authorize_interaction?uri=${encodeURIComponent(value)}`;
  }
  return `#/${PREFIX[kind]}${encodeURIComponent(value).replaceAll('%40', '@')}`;
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
