/**
 * Tests for where a media window opens (WFE-263): a float with no settings,
 * the reader's `openIn.media` over that, and `--in` over both; and that the
 * kind can be placed at all.
 */
import { describe, expect, it } from 'vitest';

import { isPlaceableKind, resolvePlacement, type PlacementSettings } from './placement';

/** The settings that decide placement, with {@link openIn} as default. */
function settings(
  openIn: PlacementSettings['openIn'],
  by: PlacementSettings['openInByKind'],
): PlacementSettings {
  return { openIn, openInByKind: by };
}

describe('placing a media window', () => {
  it('floats with no settings, whatever openIn says', () => {
    expect(resolvePlacement(settings('here', {}), 'media', null)).toBe('float');
    expect(resolvePlacement(settings('split', {}), 'media', null)).toBe('float');
  });

  it('follows the reader’s openIn.media over the default', () => {
    expect(resolvePlacement(settings('here', { media: 'vsplit' }), 'media', null)).toBe('vsplit');
  });

  it('follows --in over both', () => {
    expect(resolvePlacement(settings('here', { media: 'vsplit' }), 'media', 'split')).toBe('split');
    expect(resolvePlacement(settings('here', {}), 'media', 'hidden')).toBe('hidden');
  });

  it('is a kind the reader can place', () => {
    expect(isPlaceableKind('media')).toBe(true);
  });
});
