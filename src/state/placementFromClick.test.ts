/**
 * Tests for placement by click (WFE-238, decision 13): the table of what each
 * button and modifier asks for over each configured placement, and the app
 * action a click opens a window with — the plain open for `here`, `openPlaced`
 * for the rest, the kind's own setting for a plain click.
 */
import { describe, expect, it } from 'vitest';

import type { OpenAction, Placement, PlacementSettings } from './placement';
import { clickOpen, placementFromClick } from './placementFromClick';
import type { ClickModifiers } from '../lib/clickModifiers';

/** A primary-button click with no modifier. */
const PLAIN: ClickModifiers = { button: 0, ctrlKey: false, metaKey: false, shiftKey: false };

/** The ask to open one profile window. */
const OPEN: OpenAction = {
  type: 'open',
  ref: { kind: 'profile', accountKey: 'a#1', target: '7' },
  title: '@nine',
};

/** Settings with {@link openIn} as default and {@link byKind} over it. */
function settings(
  openIn: Placement,
  byKind: PlacementSettings['openInByKind'] = {},
): PlacementSettings {
  return { openIn, openInByKind: byKind };
}

describe(placementFromClick, () => {
  it.each<readonly [string, Partial<ClickModifiers>, Placement | null]>([
    ['a plain click', {}, null],
    ['Ctrl+click', { ctrlKey: true }, 'float'],
    ['Cmd+click', { metaKey: true }, 'float'],
    ['Shift+click', { shiftKey: true }, 'vsplit'],
    ['Ctrl+Shift+click', { ctrlKey: true, shiftKey: true }, 'float'],
    ['a middle click', { button: 1 }, 'hidden'],
    ['a middle click with Ctrl', { button: 1, ctrlKey: true }, 'hidden'],
  ])('answers for %s', (_name, init, expected) => {
    for (const configured of ['here', 'split', 'float', 'hidden'] as const) {
      expect(placementFromClick({ ...PLAIN, ...init }, configured)).toBe(expected ?? configured);
    }
  });
});

describe(clickOpen, () => {
  it('opens in place with the plain open when the configured placement is here', () => {
    expect(clickOpen(settings('here'), OPEN, PLAIN)).toStrictEqual({
      type: 'windows',
      action: OPEN,
    });
  });

  it('places a plain click as the default says', () => {
    expect(clickOpen(settings('float'), OPEN, PLAIN)).toStrictEqual({
      type: 'openPlaced',
      action: OPEN,
      placement: 'float',
    });
  });

  it('places a plain click as the kind setting says over the default', () => {
    expect(clickOpen(settings('float', { profile: 'split' }), OPEN, PLAIN)).toMatchObject({
      type: 'openPlaced',
      placement: 'split',
    });
  });

  it.each<readonly [Partial<ClickModifiers>, Placement]>([
    [{ shiftKey: true }, 'vsplit'],
    [{ ctrlKey: true }, 'float'],
    [{ button: 1 }, 'hidden'],
  ])('lets the modifiers %j override the settings', (init, placement) => {
    expect(
      clickOpen(settings('here', { profile: 'split' }), OPEN, { ...PLAIN, ...init }),
    ).toStrictEqual({
      type: 'openPlaced',
      action: OPEN,
      placement,
    });
  });
});
