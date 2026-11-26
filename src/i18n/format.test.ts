/**
 * Tests for the locale-aware figures (decision 19): digit grouping, percent,
 * the 24- and 12-hour clock and the numeric day in English, German and
 * Japanese, on fixed moments, plus the plural words and the whois line of a
 * catalog in each language.
 */
import { describe, expect, it } from 'vitest';

import { formatClock, formatDay, formatNumber, formatPercent } from './format';
import { translate } from './translate';
import { installFakeLocale } from '../test/i18n';

/** 23:04 local time, a quarter past nothing: the evening of a 24-hour clock. */
const EVENING = new Date(2026, 0, 2, 23, 4);

describe(formatNumber, () => {
  it('groups digits the way the language does', () => {
    expect(formatNumber('en', 1234567)).toBe('1,234,567');
    expect(formatNumber('de', 1234567)).toBe('1.234.567');
    expect(formatNumber('ja', 1234)).toBe('1,234');
  });

  it('leaves a small number alone', () => {
    expect(formatNumber('en', 8)).toBe('8');
  });
});

describe(formatPercent, () => {
  it('writes a share as a whole percentage', () => {
    expect(formatPercent('en', 0.3)).toBe('30%');
    expect(formatPercent('ja', 0.3)).toBe('30%');
    expect(formatPercent('de', 0.3)).toMatch(/^30\s%$/u);
  });
});

describe(formatClock, () => {
  it('shows the 24-hour clock zero-padded in every language', () => {
    expect(formatClock('en', new Date(2026, 0, 2, 3, 4), '24h')).toBe('03:04');
    expect(formatClock('de', new Date(2026, 0, 2, 3, 4), '24h')).toBe('03:04');
    expect(formatClock('ja', new Date(2026, 0, 2, 3, 4), '24h')).toBe('03:04');
  });

  it('shows midnight as 00:00 and the last minute as 23:59', () => {
    expect(formatClock('en', new Date(2026, 0, 1, 0, 0), '24h')).toBe('00:00');
    expect(formatClock('en', new Date(2026, 0, 2, 23, 59), '24h')).toBe('23:59');
  });

  it('shows the 12-hour clock with a lowercase day period set tight in English', () => {
    expect(formatClock('en', new Date(2026, 0, 1, 0, 0), '12h')).toBe('12:00am');
    expect(formatClock('en', new Date(2026, 0, 1, 12, 0), '12h')).toBe('12:00pm');
    expect(formatClock('en', new Date(2026, 0, 2, 3, 4), '12h')).toBe('3:04am');
    expect(formatClock('en', EVENING, '12h')).toBe('11:04pm');
  });

  it('shows the 12-hour clock in the other languages', () => {
    expect(formatClock('de', EVENING, '12h')).toMatch(/^11:04/u);
    expect(formatClock('ja', EVENING, '12h')).toContain('11:04');
  });
});

describe(formatDay, () => {
  const day = new Date(Date.UTC(2026, 10, 24, 23, 59));

  it('keeps English dates ISO, and gives other languages their own order', () => {
    expect(formatDay('en', day)).toBe('2026-11-24');
    expect(formatDay('de', day)).toBe('24.11.2026');
    expect(formatDay('ja', day)).toBe('2026/11/24');
  });

  it('names the day of the moment in UTC, wherever the reader is', () => {
    expect(formatDay('en', new Date(Date.UTC(2026, 10, 24, 0, 0)))).toBe('2026-11-24');
  });

  it('says nothing for a date that is not one', () => {
    expect(formatDay('en', new Date(Number.NaN))).toBe('');
  });
});

describe('the words around the figures', () => {
  it('counts in English with a singular and a plural', () => {
    expect(translate('en', 'format.vote_count', { count: 1 })).toBe('1 vote');
    expect(translate('en', 'format.vote_count', { count: 1234 })).toBe('1,234 votes');
    expect(translate('en', 'format.reply_to_counted', { label: 'a3', count: 2 })).toBe(
      'Reply to post a3 (2 replies)',
    );
  });

  it('counts in German with its grouping and its words', () => {
    installFakeLocale(
      { format: { vote_count: '{count, plural, one {# Stimme} other {# Stimmen}}' } },
      'de',
    );

    expect(translate('de', 'format.vote_count', { count: 1 })).toBe('1 Stimme');
    expect(translate('de', 'format.vote_count', { count: 1234 })).toBe('1.234 Stimmen');
  });

  it('counts in Japanese with one form for every number', () => {
    installFakeLocale({ format: { vote_count: '{count, plural, other {#票}}' } }, 'ja');

    expect(translate('ja', 'format.vote_count', { count: 1 })).toBe('1票');
    expect(translate('ja', 'format.vote_count', { count: 1234 })).toBe('1,234票');
  });

  it('writes the whois counters with the grouping of the language', () => {
    installFakeLocale(
      {
        format: {
          whois_counts:
            'Beiträge {posts, number} · folgt {following, number} · Follower {followers, number} · seit {joined}',
        },
      },
      'de',
    );

    expect(
      translate('de', 'format.whois_counts', {
        posts: 1234,
        following: 2,
        followers: 12345,
        joined: formatDay('de', new Date(Date.UTC(2026, 10, 24))),
      }),
    ).toBe('Beiträge 1.234 · folgt 2 · Follower 12.345 · seit 24.11.2026');
  });
});
