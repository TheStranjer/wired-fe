/**
 * URL helpers (AGENTS.md "Layout": src/lib holds pure helpers): the scheme
 * check every server-provided URL passes before it may reach the DOM as an
 * `href` or `src`. Pure: no state, no I/O.
 */

/** Whether `href` parses as an absolute URL over http: or https:. */
export function isHttpUrl(href: string): boolean {
  try {
    const { protocol } = new URL(href);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
