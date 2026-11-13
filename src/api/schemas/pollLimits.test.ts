/**
 * Tests for the poll-limit extractors: readKey's tolerance of any value,
 * nonNegativeInt's number rules, and extractPollLimits' all-or-nothing
 * reading of a poll block with either document's key spelling.
 */
import { describe, expect, it } from 'vitest';

import { extractPollLimits, nonNegativeInt, readKey } from './pollLimits';

describe(readKey, () => {
  it('reads a key from an object', () => {
    expect(readKey({ a: 1 }, 'a')).toBe(1);
  });

  it('returns undefined for a missing key', () => {
    expect(readKey({ a: 1 }, 'b')).toBeUndefined();
  });

  it('returns undefined for non-objects', () => {
    expect(readKey('nope', 'a')).toBeUndefined();
    expect(readKey(7, 'a')).toBeUndefined();
    expect(readKey(null, 'a')).toBeUndefined();
    expect(readKey(undefined, 'a')).toBeUndefined();
  });
});

describe(nonNegativeInt, () => {
  it('keeps zero and positive integers', () => {
    expect(nonNegativeInt(0)).toBe(0);
    expect(nonNegativeInt(500)).toBe(500);
  });

  it('rejects fractions, negatives and non-numbers', () => {
    expect(nonNegativeInt(1.5)).toBeNull();
    expect(nonNegativeInt(-1)).toBeNull();
    expect(nonNegativeInt('500')).toBeNull();
    expect(nonNegativeInt(null)).toBeNull();
    expect(nonNegativeInt(undefined)).toBeNull();
  });

  it('rejects NaN and Infinity', () => {
    expect(nonNegativeInt(Number.NaN)).toBeNull();
    expect(nonNegativeInt(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe(extractPollLimits, () => {
  it('reads a Mastodon-style configuration.polls block', () => {
    expect(
      extractPollLimits(
        {
          max_options: 4,
          max_characters_per_option: 30,
          min_expiration: 300,
          max_expiration: 2_592_000,
        },
        'max_characters_per_option',
      ),
    ).toStrictEqual({
      maxOptions: 4,
      maxCharactersPerOption: 30,
      minExpiration: 300,
      maxExpiration: 2_592_000,
    });
  });

  it('reads a Pleroma-style poll_limits block under its own key', () => {
    expect(
      extractPollLimits(
        { max_options: 6, max_option_chars: 40, min_expiration: 60, max_expiration: 86_400 },
        'max_option_chars',
      ),
    ).toStrictEqual({
      maxOptions: 6,
      maxCharactersPerOption: 40,
      minExpiration: 60,
      maxExpiration: 86_400,
    });
  });

  it('returns null for a partial block', () => {
    expect(
      extractPollLimits({ max_options: 4, min_expiration: 300 }, 'max_characters_per_option'),
    ).toBeNull();
  });

  it('returns null when a number is malformed', () => {
    expect(
      extractPollLimits(
        {
          max_options: 'four',
          max_characters_per_option: 30,
          min_expiration: 300,
          max_expiration: 2_592_000,
        },
        'max_characters_per_option',
      ),
    ).toBeNull();
  });

  it('returns null for an absent or non-object block', () => {
    expect(extractPollLimits(undefined, 'max_characters_per_option')).toBeNull();
    expect(extractPollLimits('polls', 'max_characters_per_option')).toBeNull();
  });
});
