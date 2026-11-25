/**
 * Tests for the composer's poll editor state: the durations an instance's
 * limits leave, a fresh poll and its default run, the add/remove/set
 * transitions, fitting a poll to another instance, and the per-option problems.
 */
import { describe, expect, it } from 'vitest';

import {
  addOption,
  checkOptions,
  durationChoices,
  fitPoll,
  newPoll,
  pollIsValid,
  removeOption,
  setOption,
} from './pollEditor';
import type { PollLimits } from '../api/schemas/pollLimits';
import { DEFAULT_POLL_LIMITS } from '../capabilities/capabilities';

/** Limits tight enough to cut the presets: three options of ten characters, 1 h to 3 d. */
const TIGHT: PollLimits = {
  maxOptions: 3,
  maxCharactersPerOption: 10,
  minExpiration: 3600,
  maxExpiration: 259_200,
};

describe(durationChoices, () => {
  it('offers all seven presets within the default limits', () => {
    expect(durationChoices(DEFAULT_POLL_LIMITS).map((choice) => choice.label)).toStrictEqual([
      '5 min',
      '30 min',
      '1 h',
      '6 h',
      '1 d',
      '3 d',
      '7 d',
    ]);
  });

  it('keeps only the presets between the instance’s minimum and maximum', () => {
    expect(durationChoices(TIGHT).map((choice) => choice.seconds)).toStrictEqual([
      3600, 21_600, 86_400, 259_200,
    ]);
  });

  it('falls back to the shortest allowed run when no preset fits', () => {
    const odd = { ...TIGHT, minExpiration: 100, maxExpiration: 200 };

    expect(durationChoices(odd)).toStrictEqual([{ seconds: 100, label: '1m' }]);
  });
});

describe(newPoll, () => {
  it('starts with two empty options, a day, single choice and shown totals', () => {
    expect(newPoll(DEFAULT_POLL_LIMITS)).toStrictEqual({
      options: ['', ''],
      expiresIn: 86_400,
      multiple: false,
      hideTotals: false,
    });
  });

  it('starts at the allowed run nearest a day', () => {
    expect(newPoll({ ...TIGHT, maxExpiration: 7200 }).expiresIn).toBe(3600);
  });
});

describe(fitPoll, () => {
  it('drops the options past the maximum and moves the run into range', () => {
    const poll = {
      options: ['a', 'b', 'c', 'd'],
      expiresIn: 300,
      multiple: true,
      hideTotals: true,
    };

    expect(fitPoll(poll, TIGHT)).toStrictEqual({
      ...poll,
      options: ['a', 'b', 'c'],
      expiresIn: 3600,
    });
  });

  it('never cuts below two options', () => {
    const poll = { options: ['a', 'b', 'c'], expiresIn: 3600, multiple: false, hideTotals: false };

    expect(fitPoll(poll, { ...TIGHT, maxOptions: 1 }).options).toStrictEqual(['a', 'b']);
  });
});

describe('option transitions', () => {
  const poll = newPoll(DEFAULT_POLL_LIMITS);

  it('sets, adds and removes options', () => {
    const typed = setOption(setOption(poll, 0, 'cats'), 1, 'dogs');

    expect(typed.options).toStrictEqual(['cats', 'dogs']);
    expect(addOption(typed).options).toStrictEqual(['cats', 'dogs', '']);
    expect(removeOption(addOption(typed), 0).options).toStrictEqual(['dogs', '']);
  });
});

describe(checkOptions, () => {
  it('names an empty option, one over the length, and a repeat of an earlier one', () => {
    const poll = { ...newPoll(TIGHT), options: ['cats', ' ', 'twelve chars', 'Cats'] };

    expect(checkOptions(poll, TIGHT).map(({ problem }) => problem)).toStrictEqual([
      null,
      'Option 2 is empty',
      'Option 3 is over 10 characters',
      'Option 4 repeats option 1',
    ]);
  });

  it('is valid once every option is filled, short and distinct', () => {
    const poll = { ...newPoll(TIGHT), options: ['cats', 'dogs'] };

    expect(pollIsValid(poll, TIGHT)).toBe(true);
    expect(pollIsValid(setOption(poll, 1, 'cats'), TIGHT)).toBe(false);
  });
});
