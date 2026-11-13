/**
 * URL building for `apiRequest`: `origin + path` plus a query string. Arrays
 * repeat the key once per element in Mastodon style (`key[]=value`), booleans
 * and numbers are stringified, and `undefined` values are skipped.
 */

/** One query parameter value, or `undefined` to leave the parameter out. */
export type QueryValue = string | number | boolean | readonly string[] | undefined;

/**
 * Appends one query value: an array adds one `key[]=value` pair per element,
 * anything else is stringified under the plain key.
 */
function appendParam(params: URLSearchParams, key: string, value: QueryValue): void {
  if (value === undefined) {
    return;
  }
  if (typeof value === 'object') {
    for (const item of value) {
      params.append(`${key}[]`, item);
    }
    return;
  }
  params.append(key, String(value));
}

/**
 * Builds the full request URL from an origin (`https://wired.example`), a path
 * starting with `/`, and optional query parameters.
 */
export function buildUrl(
  origin: string,
  path: string,
  query: Readonly<Record<string, QueryValue>> | undefined,
): string {
  const url = new URL(origin + path);
  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      appendParam(url.searchParams, key, value);
    }
  }
  return url.toString();
}
