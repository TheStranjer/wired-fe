/**
 * ASCII bars for poll tallies (WFE-98): fixed-width cells on the monospace
 * grid, filled for an option's share of the votes and empty for the rest.
 * Pure text: choosing the glyphs is arithmetic, drawing them is the ui's job.
 */

/** One cell of bar an option's share won. */
const FULL = '█';

/** One cell of bar the rest of the votes did not reach. */
const EMPTY = '░';

/**
 * A bar of {@link width} cells: filled `█` for the share, `░` for the rest.
 * `share` is read in [0,1] — anything outside it is clamped — and rounds to
 * the nearest cell, halves up.
 */
export function bar(share: number, width: number): string {
  const ratio = Math.min(Math.max(share, 0), 1);
  const filled = Math.round(ratio * width);
  return `${FULL.repeat(filled)}${EMPTY.repeat(width - filled)}`;
}
