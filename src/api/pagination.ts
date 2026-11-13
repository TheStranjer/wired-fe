/**
 * Parses HTTP `Link` headers into pagination cursors. Mastodon, Pleroma and
 * Wired all page their list endpoints with a header like
 * `<https://ex/api/v1/timelines/home?max_id=109>; rel="next", ...; rel="prev"`.
 */

/** Query parameters of one pagination link, e.g. { max_id: "109" }. */
export type PageCursor = Readonly<Record<string, string>>;

/** The `next` and `prev` cursors of a response, null when that link is absent. */
export type PageLinks = {
  readonly next: PageCursor | null;
  readonly prev: PageCursor | null;
};

/** One `<URL>; rel="name"` entry of the header. */
type Link = {
  readonly rel: 'next' | 'prev';
  readonly cursor: PageCursor;
};

/**
 * A comma starts a new entry only when a `<` follows before the next comma,
 * so commas inside a URL's query survive the split.
 */
const ENTRY_BOUNDARY = /,(?=[^,]*<)/u;

/** `rel` as a quoted string, e.g. `; rel="next"`. */
const REL_QUOTED = /(?:^|[;\s])rel\s*=\s*"([^"]*)"/iu;

/** `rel` as a bare token, e.g. `; rel=next`. */
const REL_UNQUOTED = /(?:^|[;\s])rel\s*=\s*([^;\s,]+)/iu;

/** The rel value of one entry's parameter part, or undefined when it has none. */
function relOf(params: string): string | undefined {
  const quoted = REL_QUOTED.exec(params);
  if (quoted !== null) {
    return quoted[1];
  }
  const token = REL_UNQUOTED.exec(params);
  return token?.[1];
}

/**
 * Reads one `<URL>; rel=name` entry: its URL's query parameters become the
 * cursor. Returns null for entries without a `<...>` part, with an unparseable
 * URL or with a rel other than next/prev.
 */
function parseEntry(segment: string): Link | null {
  const open = segment.indexOf('<');
  const close = segment.indexOf('>', open + 1);
  if (open < 0 || close < 0) {
    return null;
  }
  const rel = relOf(segment.slice(close + 1));
  if (rel !== 'next' && rel !== 'prev') {
    return null;
  }
  try {
    const url = new URL(segment.slice(open + 1, close).trim());
    return { rel, cursor: Object.fromEntries(url.searchParams) };
  } catch {
    return null;
  }
}

/**
 * Parses a response's `Link` header into its pagination cursors. Malformed
 * entries are ignored; when the same rel appears twice the first one wins.
 */
export function parseLinkHeader(header: string | null): PageLinks {
  if (header === null || header.trim() === '') {
    return { next: null, prev: null };
  }
  const found: Partial<Record<'next' | 'prev', PageCursor>> = {};
  for (const segment of header.split(ENTRY_BOUNDARY)) {
    const link = parseEntry(segment);
    if (link === null || found[link.rel] !== undefined) {
      continue;
    }
    found[link.rel] = link.cursor;
  }
  return { next: found.next ?? null, prev: found.prev ?? null };
}
