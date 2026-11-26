/**
 * Locale-aware numbers, percentages, clock times and days (decision 19), built
 * on `Intl.NumberFormat` and `Intl.DateTimeFormat` with a language passed in.
 * They keep the terminal look: a 24-hour clock, numeric dates, no weekday or
 * month names. One formatter is built per language and shape, then reused.
 * Words around the numbers (plurals included) are catalog messages under
 * `format.*`; these functions only render the figures.
 */

import type { ClockFormat } from '../lib/time';

/** The formatters built so far, by language (and shape). */
const numbers = new Map<string, Intl.NumberFormat>();
const percents = new Map<string, Intl.NumberFormat>();
const clocks = new Map<string, Intl.DateTimeFormat>();
const days = new Map<string, Intl.DateTimeFormat>();

/**
 * The language whose numeric-date pattern a language borrows. English dates
 * stay ISO (`2026-11-24`), which is how the terminal look wrote them before
 * dates followed the language; `en-CA` has that pattern.
 */
const DAY_PATTERN: Readonly<Record<string, string>> = { en: 'en-CA' };

/** The formatter held under {@link key} in {@link cache}, made by {@link make} on first use. */
function cached<T>(cache: Map<string, T>, key: string, make: () => T): T {
  const held = cache.get(key);
  if (held !== undefined) {
    return held;
  }
  const made = make();
  cache.set(key, made);
  return made;
}

/** {@link value} with the digit grouping of {@link locale}: `1,234`, `1.234`. */
export function formatNumber(locale: string, value: number): string {
  return cached(numbers, locale, () => new Intl.NumberFormat(locale)).format(value);
}

/** {@link ratio} (0.3) as a whole-number percentage in {@link locale}: `30%`. */
export function formatPercent(locale: string, ratio: number): string {
  const make = (): Intl.NumberFormat => new Intl.NumberFormat(locale, { style: 'percent' });
  return cached(percents, locale, make).format(ratio);
}

/** The options of a clock in {@link format}: 24-hour (`hourCycle: 'h23'`) or 12-hour. */
function clockOptions(format: ClockFormat): Intl.DateTimeFormatOptions {
  return format === '24h'
    ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
    : { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' };
}

/**
 * The local hours and minutes of {@link date} in {@link locale}: `23:04` on
 * the 24-hour clock; on the 12-hour one `11:04pm`, the day period lowercase
 * and tight against the time, as the terminal always showed it.
 */
export function formatClock(locale: string, date: Date, format: ClockFormat): string {
  const make = (): Intl.DateTimeFormat => new Intl.DateTimeFormat(locale, clockOptions(format));
  return cached(clocks, `${locale}|${format}`, make)
    .formatToParts(date)
    .filter((part) => part.type !== 'literal' || part.value.trim() !== '')
    .map((part) => (part.type === 'dayPeriod' ? part.value.toLowerCase() : part.value))
    .join('');
}

/**
 * The UTC calendar day of {@link date} as digits in {@link locale}'s order:
 * `2026-11-24` in English, `24.11.2026` in German, `2026/11/24` in Japanese.
 * An invalid date gives nothing.
 */
export function formatDay(locale: string, date: Date): string {
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const make = (): Intl.DateTimeFormat =>
    new Intl.DateTimeFormat(DAY_PATTERN[locale] ?? locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC',
    });
  return cached(days, locale, make).format(date);
}
