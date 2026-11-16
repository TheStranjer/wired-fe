/**
 * Duration formatting for the spans the app names to its user: instance poll
 * limits are counted in seconds, while `/about` and `/poll` show them as whole
 * numbers of the largest unit they reach. Pure helpers only, no I/O.
 */

/** The duration units from largest to smallest: seconds per unit, and suffix. */
const DURATION_UNITS: readonly (readonly [number, string])[] = [
  [86_400, 'd'],
  [3_600, 'h'],
  [60, 'm'],
];

/**
 * Format {@link seconds} as a whole number of the largest unit it reaches:
 * `5m`, `1h`, `30d`. Anything shorter than a minute counts in seconds.
 */
export function formatDuration(seconds: number): string {
  const unit = DURATION_UNITS.find(([size]) => seconds >= size);
  if (unit === undefined) {
    return `${String(seconds)}s`;
  }
  const [size, suffix] = unit;
  return `${String(Math.floor(seconds / size))}${suffix}`;
}
