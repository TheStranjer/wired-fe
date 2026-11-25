/**
 * Tests for capability derivation (decision 5): the flags advertised by a
 * Pleroma-dialect backend, Mastodon's editing-only set regardless of feature
 * strings, the empty set of an unknown backend, the v2-over-v1-over-default
 * limits and the union of the NodeInfo and v1 feature lists. The
 * hasFeature/withoutFeature helpers are tested in ./capabilities.helpers.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_POLL_LIMITS,
  type FeatureFlag,
  deriveCapabilities,
  hasFeature,
} from './capabilities';
import {
  MARKDOWN_FORMATS,
  WIRED_FEATURES,
  nodeInfoNamed,
  v1Doc,
  v2Doc,
} from '../test/instanceDocs';

/** Every flag a full Wired instance therefore carries. */
const ALL_FLAGS: readonly FeatureFlag[] = [
  'emojiReactions',
  'customEmojiReactions',
  'quotePosting',
  'editing',
  'localOnlyPosts',
  'markdown',
  'passwordResetApi',
  'settingsStore',
];

describe(deriveCapabilities, () => {
  it('gives a Wired instance with the full feature list every flag', () => {
    const caps = deriveCapabilities({
      nodeInfo: nodeInfoNamed('wired'),
      v1: v1Doc({ maxCharacters: 5000, postFormats: MARKDOWN_FORMATS }),
      v2: null,
    });

    expect(caps.backend).toBe('wired');
    expect(caps.maxCharacters).toBe(5000);
    expect(caps.features).toStrictEqual(new Set(ALL_FLAGS));
  });

  it('keeps the feature strings themselves out of the flag set', () => {
    const caps = deriveCapabilities({ nodeInfo: nodeInfoNamed('wired'), v1: null, v2: null });

    expect([...caps.features]).not.toContain('pleroma_api');
    expect(caps.maxCharacters).toBe(500);
    expect(caps.maxMediaAttachments).toBe(4);
    expect(caps.pollLimits).toBe(DEFAULT_POLL_LIMITS);
  });

  it('omits quotePosting for a Pleroma instance that does not advertise quote_posting', () => {
    const features = WIRED_FEATURES.filter((feature) => feature !== 'quote_posting');
    const caps = deriveCapabilities({
      nodeInfo: nodeInfoNamed('pleroma', features),
      v1: v1Doc({ postFormats: MARKDOWN_FORMATS }),
      v2: null,
    });

    expect(caps.backend).toBe('pleroma');
    expect(hasFeature(caps, 'quotePosting')).toBe(false);
    expect(caps.features).toStrictEqual(
      new Set(ALL_FLAGS.filter((flag) => flag !== 'quotePosting')),
    );
  });

  it('gives a Pleroma-family instance markdown only when post_formats lists text/markdown', () => {
    const nodeInfo = nodeInfoNamed('pleroma');
    const withMarkdown = deriveCapabilities({
      nodeInfo,
      v1: v1Doc({ postFormats: MARKDOWN_FORMATS }),
      v2: null,
    });
    const without = deriveCapabilities({
      nodeInfo,
      v1: v1Doc({ postFormats: ['text/plain', 'text/html'] }),
      v2: null,
    });
    const unlisted = deriveCapabilities({ nodeInfo, v1: null, v2: null });

    expect(hasFeature(withMarkdown, 'markdown')).toBe(true);
    expect(hasFeature(without, 'markdown')).toBe(false);
    expect(hasFeature(unlisted, 'markdown')).toBe(false);
    expect(hasFeature(without, 'localOnlyPosts')).toBe(true);
  });

  it('reads the union of the NodeInfo and v1 feature lists', () => {
    const caps = deriveCapabilities({
      nodeInfo: nodeInfoNamed('akkoma', []),
      v1: v1Doc({ features: ['pleroma_emoji_reactions'] }),
      v2: null,
    });

    expect(caps.backend).toBe('akkoma');
    expect(caps.features).toStrictEqual(
      new Set(['emojiReactions', 'localOnlyPosts', 'passwordResetApi', 'settingsStore']),
    );
  });

  it('gives Mastodon quotePosting from API version 7 on', () => {
    const nodeInfo = nodeInfoNamed('mastodon', []);
    const current = deriveCapabilities({
      nodeInfo,
      v1: null,
      v2: v2Doc({ mastodonApiVersion: 12 }),
    });
    const first = deriveCapabilities({ nodeInfo, v1: null, v2: v2Doc({ mastodonApiVersion: 7 }) });
    const older = deriveCapabilities({ nodeInfo, v1: null, v2: v2Doc({ mastodonApiVersion: 6 }) });
    const unversioned = deriveCapabilities({
      nodeInfo,
      v1: null,
      v2: v2Doc({ mastodonApiVersion: null }),
    });
    const withoutV2 = deriveCapabilities({ nodeInfo, v1: null, v2: null });

    expect(current.features).toStrictEqual(new Set(['editing', 'quotePosting']));
    expect(hasFeature(first, 'quotePosting')).toBe(true);
    expect(hasFeature(older, 'quotePosting')).toBe(false);
    expect(hasFeature(unversioned, 'quotePosting')).toBe(false);
    expect(hasFeature(withoutV2, 'quotePosting')).toBe(false);
  });

  it('gives Mastodon only editing below API version 7 and prefers v2 limits over v1 ones', () => {
    const caps = deriveCapabilities({
      nodeInfo: nodeInfoNamed('mastodon', ['pleroma_emoji_reactions', 'editing']),
      v1: v1Doc({
        maxCharacters: 500,
        maxMediaAttachments: 4,
        pollLimits: DEFAULT_POLL_LIMITS,
        features: WIRED_FEATURES,
      }),
      v2: v2Doc({
        maxCharacters: 5000,
        maxMediaAttachments: 6,
        pollLimits: {
          maxOptions: 6,
          maxCharactersPerOption: 60,
          minExpiration: 60,
          maxExpiration: 86400,
        },
      }),
    });

    expect(caps.backend).toBe('mastodon');
    expect(caps.features).toStrictEqual(new Set(['editing']));
    expect(caps.maxCharacters).toBe(5000);
    expect(caps.maxMediaAttachments).toBe(6);
    expect(caps.pollLimits).toStrictEqual({
      maxOptions: 6,
      maxCharactersPerOption: 60,
      minExpiration: 60,
      maxExpiration: 86400,
    });
  });

  it('falls back to v1 limits when v2 carries none', () => {
    const caps = deriveCapabilities({
      nodeInfo: nodeInfoNamed('wired', []),
      v1: v1Doc({ maxCharacters: 3000, maxMediaAttachments: 8, pollLimits: DEFAULT_POLL_LIMITS }),
      v2: v2Doc(),
    });

    expect(caps.maxCharacters).toBe(3000);
    expect(caps.maxMediaAttachments).toBe(8);
    expect(caps.pollLimits).toBe(DEFAULT_POLL_LIMITS);
  });

  it('gives an unknown backend no flags and every default', () => {
    const caps = deriveCapabilities({
      nodeInfo: nodeInfoNamed('misskey', WIRED_FEATURES),
      v1: null,
      v2: null,
    });

    expect(caps.backend).toBe('unknown');
    expect(caps.features.size).toBe(0);
    expect(caps.maxCharacters).toBe(500);
    expect(caps.maxMediaAttachments).toBe(4);
    expect(caps.pollLimits).toStrictEqual({
      maxOptions: 4,
      maxCharactersPerOption: 50,
      minExpiration: 300,
      maxExpiration: 2629746,
    });
  });
});
