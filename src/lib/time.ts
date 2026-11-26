/**
 * Clock vocabulary shared across layers: the clock format a setting names and
 * the current moment. Rendering a clock in a language lives in src/i18n/format;
 * these helpers hold no timers and no rendering.
 */

/** How to render a clock time: 24-hour (`23:04`) or 12-hour (`11:04pm`). */
export type ClockFormat = '24h' | '12h';

/** The current moment, as the `now` seam of a post context takes it. */
export function currentMoment(): Date {
  return new Date();
}
