/**
 * Quote extraction for the Status schema (decision 7): pulls the raw quoted
 * status out of any of the three shapes a backend sends it in. Wired puts the
 * full status in the top-level `quote` and mirrors it in `pleroma.quote`;
 * Pleroma only ever uses `pleroma.quote`; Mastodon 4.5+ wraps the status as
 * `{ state, quoted_status }`, or sends the shallow `{ state, quoted_status_id }`
 * when the quote nests too deep. The value returned here is unvalidated raw
 * data: the Status schema decides whether it is a status at all. This helper
 * lives on its own so that status.ts stays within its size limits.
 */

/** The value any of the three backends carries a quoted status in. */
export function rawQuote(input: {
  readonly quote?: unknown;
  readonly pleroma?: { readonly quote?: unknown } | null;
}): unknown {
  const { quote } = input;
  if (quote !== null && typeof quote === 'object') {
    if ('quoted_status' in quote) {
      return quote.quoted_status;
    }
    return quote;
  }
  const pleromaQuote = input.pleroma?.quote;
  if (pleromaQuote !== undefined) {
    return pleromaQuote;
  }
  return null;
}
