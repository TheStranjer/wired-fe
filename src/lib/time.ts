/**
 * Clock formatting for the scrollback: every line carries a local-time prefix,
 * IRC style. Pure helpers only, no rendering and no timers.
 */

/** How to render a clock time: 24-hour (`23:04`) or 12-hour (`11:04pm`). */
export type ClockFormat = '24h' | '12h';

/** Render a non-negative integer zero-padded to two digits. */
function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Format the local hours and minutes of {@link date} as a clock string.
 * `'24h'` gives `HH:MM`; `'12h'` gives `h:MMam`/`h:MMpm` with midnight
 * rendered as `12:00am` and noon as `12:00pm`.
 */
export function formatClock(date: Date, format: ClockFormat): string {
  const hour24 = date.getHours();
  const minutes = pad(date.getMinutes());
  if (format === '24h') {
    return `${pad(hour24)}:${minutes}`;
  }
  const hour12 = hour24 % 12;
  const suffix = hour24 < 12 ? 'am' : 'pm';
  return `${String(hour12 === 0 ? 12 : hour12)}:${minutes}${suffix}`;
}
