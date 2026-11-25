/**
 * Tests for the audiences an instance offers (WFE-172): `local` only with
 * `localOnlyPosts`, the four common ones otherwise and while nothing is known.
 */
import { describe, expect, it } from 'vitest';

import { capabilitiesOn } from './testCapabilities';
import { availableVisibilities } from './visibilities';

describe(availableVisibilities, () => {
  it('adds local when the instance has local-only posts', () => {
    const caps = capabilitiesOn('wired', ['localOnlyPosts']);

    expect(availableVisibilities(caps)).toStrictEqual([
      'public',
      'unlisted',
      'private',
      'direct',
      'local',
    ]);
  });

  it('leaves local out for an instance without it', () => {
    const caps = capabilitiesOn('mastodon', ['editing']);

    expect(availableVisibilities(caps)).toStrictEqual(['public', 'unlisted', 'private', 'direct']);
  });

  it('leaves local out while the capabilities are unknown', () => {
    expect(availableVisibilities(null)).toStrictEqual(['public', 'unlisted', 'private', 'direct']);
  });
});
