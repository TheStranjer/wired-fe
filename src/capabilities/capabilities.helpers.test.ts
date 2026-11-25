/**
 * Tests for the capability helpers (decision 5): hasFeature tells a carried
 * flag from an absent one, and withoutFeature drops a flag that advertised
 * itself but answered 404/501 without touching the original.
 */
import { describe, expect, it } from 'vitest';

import { type FeatureFlag, deriveCapabilities, hasFeature, withoutFeature } from './capabilities';
import { MARKDOWN_FORMATS, nodeInfoNamed, v1Doc } from '../test/instanceDocs';

/** Every flag a full Wired instance carries. */
const ALL_FLAGS: readonly FeatureFlag[] = [
  'emojiReactions',
  'customEmojiReactions',
  'quotePosting',
  'editing',
  'localOnlyPosts',
  'markdown',
  'passwordResetApi',
];

describe(hasFeature, () => {
  it('is true for a carried flag and false for an absent one', () => {
    const caps = deriveCapabilities({ nodeInfo: nodeInfoNamed('wired'), v1: null, v2: null });

    expect(hasFeature(caps, 'localOnlyPosts')).toBe(true);
    expect(hasFeature(caps, 'emojiReactions')).toBe(true);

    const mastodon = deriveCapabilities({
      nodeInfo: nodeInfoNamed('mastodon'),
      v1: null,
      v2: null,
    });

    expect(hasFeature(mastodon, 'editing')).toBe(true);
    expect(hasFeature(mastodon, 'emojiReactions')).toBe(false);
  });
});

describe(withoutFeature, () => {
  it('drops a carried flag without touching the original', () => {
    const caps = deriveCapabilities({
      nodeInfo: nodeInfoNamed('wired'),
      v1: v1Doc({ maxCharacters: 5000, postFormats: MARKDOWN_FORMATS }),
      v2: null,
    });
    const trimmed = withoutFeature(caps, 'emojiReactions');

    expect(trimmed).not.toBe(caps);
    expect(hasFeature(caps, 'emojiReactions')).toBe(true);
    expect(hasFeature(trimmed, 'emojiReactions')).toBe(false);
    expect(trimmed.maxCharacters).toBe(5000);
    expect(trimmed.features).toStrictEqual(
      new Set(ALL_FLAGS.filter((flag) => flag !== 'emojiReactions')),
    );
  });

  it('returns the same object when the flag was already absent', () => {
    const caps = deriveCapabilities({ nodeInfo: nodeInfoNamed('wired'), v1: null, v2: null });
    const trimmed = withoutFeature(caps, 'emojiReactions');

    expect(withoutFeature(trimmed, 'emojiReactions')).toBe(trimmed);

    const mastodon = deriveCapabilities({
      nodeInfo: nodeInfoNamed('mastodon'),
      v1: null,
      v2: null,
    });

    expect(withoutFeature(mastodon, 'quotePosting')).toBe(mastodon);
  });
});
