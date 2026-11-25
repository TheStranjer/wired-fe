/**
 * The rule for making a desktop: allowed only past a last desktop with
 * something on it, never more than one at a time, with the reason spelled out.
 */
import { describe, expect, it } from 'vitest';

import { appendRefusal, canAppendDesktop } from './desktopAppend';
import { three, twoPanes, withFloats } from './desktopFixtures';
import { EMPTY_DESKTOP } from './desktopPanes';

describe(canAppendDesktop, () => {
  it('allows it past a last desktop with panes, or with only a float', () => {
    const floating = { ...EMPTY_DESKTOP, floats: withFloats().floats };

    expect(canAppendDesktop(twoPanes())).toBe(true);
    expect(canAppendDesktop({ desktops: [floating], active: 0 })).toBe(true);
  });

  it('refuses it past an empty last desktop', () => {
    expect(canAppendDesktop(three())).toBe(false);
  });

  it('allows it when there are no desktops at all', () => {
    expect(canAppendDesktop({ desktops: [], active: 0 })).toBe(true);
  });
});

describe(appendRefusal, () => {
  it('never refuses an existing desktop, empty or not', () => {
    expect(appendRefusal(three(), 1)).toBeNull();
    expect(appendRefusal(three(), 3)).toBeNull();
  });

  it('allows the one desktop past a last desktop with something on it', () => {
    expect(appendRefusal(twoPanes(), 2)).toBeNull();
  });

  it('says to put something on the empty last desktop you are on', () => {
    const state = { ...three(), active: 2 };

    expect(appendRefusal(state, 4)).toBe(
      'Desktop 3 is empty: put something on it before making another',
    );
  });

  it('says to use the empty last desktop when you are elsewhere', () => {
    expect(appendRefusal(three(), 4)).toBe('Desktop 3 is empty: use it before making another');
  });

  it('names the range for a number further past the end', () => {
    expect(appendRefusal(twoPanes(), 20)).toBe('No desktop 20; desktops run 1–1');
    expect(appendRefusal(three(), 5)).toBe('No desktop 5; desktops run 1–3');
  });
});
