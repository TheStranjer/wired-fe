/**
 * Tests for capability derivation (decision 5): the flags advertised by a
 * Pleroma-dialect backend, Mastodon's editing-only set regardless of feature
 * strings, the empty set of an unknown backend, the v2-over-v1-over-default
 * limits, the union of the NodeInfo and v1 feature lists, and the
 * hasFeature/withoutFeature helpers.
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_POLL_LIMITS,
  type FeatureFlag,
  deriveCapabilities,
  hasFeature,
  withoutFeature,
} from './capabilities';
import type { InstanceV1 } from '../api/schemas/instanceV1';
import type { InstanceV2 } from '../api/schemas/instanceV2';
import type { NodeInfo } from '../api/schemas/nodeinfo';

/** The feature strings a full Wired instance advertises. */
const WIRED_FEATURES: readonly string[] = [
  'pleroma_api',
  'mastodon_api',
  'pleroma_emoji_reactions',
  'pleroma_custom_emoji_reactions',
  'pleroma_chat_messages',
  'editing',
  'quote_posting',
  'pleroma:bookmark_folders',
];

/** Every flag a full Wired instance therefore carries. */
const ALL_FLAGS: readonly FeatureFlag[] = [
  'emojiReactions',
  'customEmojiReactions',
  'chats',
  'quotePosting',
  'bookmarkFolders',
  'editing',
  'localOnlyPosts',
  'markdown',
];

/** A NodeInfo document naming {@link name} and advertising {@link features}. */
function nodeInfoNamed(name: string, features: readonly string[] = WIRED_FEATURES): NodeInfo {
  return {
    version: '2.1',
    software: { name, version: '1.0.0' },
    openRegistrations: false,
    features,
    nodeName: 'test.example',
  };
}

/** A v1 document with the given limits and advertised features. */
function v1Doc(overrides: Partial<InstanceV1> = {}): InstanceV1 {
  return {
    title: 'Test',
    version: '1.0.0',
    maxCharacters: null,
    maxMediaAttachments: null,
    pollLimits: null,
    features: [],
    ...overrides,
  };
}

/** A v2 document with the given limits. */
function v2Doc(overrides: Partial<InstanceV2> = {}): InstanceV2 {
  return {
    title: 'Test',
    version: '4.0.0',
    mastodonApiVersion: 1,
    maxCharacters: null,
    maxMediaAttachments: null,
    pollLimits: null,
    ...overrides,
  };
}

describe(deriveCapabilities, () => {
  it('gives a Wired instance with the full feature list every flag', () => {
    const caps = deriveCapabilities({
      nodeInfo: nodeInfoNamed('wired'),
      v1: v1Doc({ maxCharacters: 5000 }),
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
      v1: null,
      v2: null,
    });

    expect(caps.backend).toBe('pleroma');
    expect(hasFeature(caps, 'quotePosting')).toBe(false);
    expect(caps.features).toStrictEqual(
      new Set(ALL_FLAGS.filter((flag) => flag !== 'quotePosting')),
    );
  });

  it('reads the union of the NodeInfo and v1 feature lists', () => {
    const caps = deriveCapabilities({
      nodeInfo: nodeInfoNamed('akkoma', []),
      v1: v1Doc({ features: ['pleroma_chat_messages'] }),
      v2: null,
    });

    expect(caps.backend).toBe('akkoma');
    expect(caps.features).toStrictEqual(new Set(['chats', 'localOnlyPosts', 'markdown']));
  });

  it('gives Mastodon only editing and prefers v2 limits over v1 ones', () => {
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

describe(hasFeature, () => {
  it('is true for a carried flag and false for an absent one', () => {
    const caps = deriveCapabilities({ nodeInfo: nodeInfoNamed('wired'), v1: null, v2: null });

    expect(hasFeature(caps, 'markdown')).toBe(true);
    expect(hasFeature(caps, 'chats')).toBe(true);

    const mastodon = deriveCapabilities({
      nodeInfo: nodeInfoNamed('mastodon'),
      v1: null,
      v2: null,
    });

    expect(hasFeature(mastodon, 'editing')).toBe(true);
    expect(hasFeature(mastodon, 'chats')).toBe(false);
  });
});

describe(withoutFeature, () => {
  it('drops a carried flag without touching the original', () => {
    const caps = deriveCapabilities({
      nodeInfo: nodeInfoNamed('wired'),
      v1: v1Doc({ maxCharacters: 5000 }),
      v2: null,
    });
    const trimmed = withoutFeature(caps, 'chats');

    expect(trimmed).not.toBe(caps);
    expect(hasFeature(caps, 'chats')).toBe(true);
    expect(hasFeature(trimmed, 'chats')).toBe(false);
    expect(trimmed.maxCharacters).toBe(5000);
    expect(trimmed.features).toStrictEqual(new Set(ALL_FLAGS.filter((flag) => flag !== 'chats')));
  });

  it('returns the same object when the flag was already absent', () => {
    const caps = deriveCapabilities({ nodeInfo: nodeInfoNamed('wired'), v1: null, v2: null });
    const trimmed = withoutFeature(caps, 'chats');

    expect(withoutFeature(trimmed, 'chats')).toBe(trimmed);

    const mastodon = deriveCapabilities({
      nodeInfo: nodeInfoNamed('mastodon'),
      v1: null,
      v2: null,
    });

    expect(withoutFeature(mastodon, 'quotePosting')).toBe(mastodon);
  });
});
