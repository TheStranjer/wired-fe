/**
 * Hash routes (decision 4): the permalinks WiredFE serves from the address
 * bar, as a string-literal-discriminated union with a parser and a formatter
 * that are each other's inverse. `#/notice/<id>` is a post, `#/@<user>` and
 * `#/@<user>@<host>` an account by name, `#/users/<id>` an account by id,
 * and `#/tag/<name>` a hashtag; every route carries the one decoded segment
 * as its `value`. Every segment is percent-encoded on the way out and decoded
 * on the way in; anything else, an empty segment or an extra segment
 * included, is not a route. Pure: nothing here reads the address bar.
 */

/** One place the address bar can point at. */
export type Route =
  | { readonly kind: 'notice'; readonly value: string }
  | { readonly kind: 'acct'; readonly value: string }
  | { readonly kind: 'user'; readonly value: string }
  | { readonly kind: 'tag'; readonly value: string };

/** A hash route: a keyword and one segment, or one `@account` segment. */
const ROUTE = /^#\/(?:(notice|users|tag)\/([^/]+)|@([^/]+))$/u;

/** What each kind's segment follows in the hash. */
const PREFIX: Readonly<Record<Route['kind'], string>> = {
  notice: 'notice/',
  acct: '@',
  user: 'users/',
  tag: 'tag/',
};

/** {@link segment} decoded, or null when its percent-escapes are malformed. */
function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * The route {@link hash} spells (`window.location.hash`, leading `#` and
 * all), or null when it is empty, junk, lacks its id, or has extra segments.
 */
export function parseRoute(hash: string): Route | null {
  const [, head, segment, account] = ROUTE.exec(hash) ?? [];
  const value = decode(segment ?? account ?? '');
  if (value === null || value === '') {
    return null;
  }
  switch (head) {
    case undefined:
      return { kind: 'acct', value };
    case 'notice':
      return { kind: 'notice', value };
    case 'users':
      return { kind: 'user', value };
    default:
      return { kind: 'tag', value };
  }
}

/** The hash (leading `#` included) that {@link route} is spelled as. */
export function formatRoute({ kind, value }: Route): string {
  return `#/${PREFIX[kind]}${encodeURIComponent(value).replaceAll('%40', '@')}`;
}
