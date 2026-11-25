/**
 * Tests for the capability gate: the capabilities come back when the flag is
 * carried, every refusal is a sentence naming the handle and the backend, no
 * flag has a missing phrase, and no raw flag name ever reaches the sentence.
 */
import { describe, expect, it } from 'vitest';

import type { Backend } from './backend';
import { type Capabilities, DEFAULT_POLL_LIMITS, type FeatureFlag } from './capabilities';
import { requireFeature } from './requireFeature';

const ORIGIN = 'https://mastodon.test';

/** Every flag, keyed so the compiler fails here when a flag is added. */
const ALL_FLAGS: Readonly<Record<FeatureFlag, true>> = {
  emojiReactions: true,
  customEmojiReactions: true,
  quotePosting: true,
  editing: true,
  localOnlyPosts: true,
  markdown: true,
};

const FLAGS = Object.keys(ALL_FLAGS) as FeatureFlag[];

/** Capabilities of a {@link backend} advertising only {@link flags}. */
function capsOf(backend: Backend, flags: readonly FeatureFlag[]): Capabilities {
  return {
    backend,
    maxCharacters: 500,
    maxMediaAttachments: 4,
    pollLimits: DEFAULT_POLL_LIMITS,
    features: new Set(flags),
  };
}

/** A context with alice signed in and her origin's capabilities as given. */
function contextWith(capabilities: Capabilities | null): Parameters<typeof requireFeature>[0] {
  return {
    state: {
      accounts: [{ key: 'alice', origin: ORIGIN, handle: 'alice@mastodon.test' }],
      profiles: capabilities === null ? new Map() : new Map([[ORIGIN, { capabilities }]]),
    },
  };
}

describe(requireFeature, () => {
  it('returns the capabilities when the flag is carried', () => {
    const capabilities = capsOf('mastodon', ['editing']);

    const result = requireFeature(contextWith(capabilities), 'alice', 'editing');

    expect(result).toStrictEqual({ ok: true, value: capabilities });
  });

  it('names the handle, the backend and what cannot be done', () => {
    const result = requireFeature(contextWith(capsOf('mastodon', [])), 'alice', 'emojiReactions');

    expect(result).toStrictEqual({
      ok: false,
      error: "@alice@mastodon.test's server (Mastodon) can't react to posts with emoji",
    });
  });

  it.each([
    ['wired', 'Wired'],
    ['pleroma', 'Pleroma'],
    ['akkoma', 'Akkoma'],
    ['mastodon', 'Mastodon'],
  ] as const)('names a %s server %s', (backend, name) => {
    const result = requireFeature(contextWith(capsOf(backend, [])), 'alice', 'editing');

    expect(result).toStrictEqual({
      ok: false,
      error: `@alice@mastodon.test's server (${name}) can't edit posts`,
    });
  });

  it('leaves the backend out when its software is unknown', () => {
    const result = requireFeature(contextWith(capsOf('unknown', [])), 'alice', 'editing');

    expect(result).toStrictEqual({
      ok: false,
      error: "@alice@mastodon.test's server can't edit posts",
    });
  });

  it('refuses as absent when the capabilities were never read', () => {
    const result = requireFeature(contextWith(null), 'alice', 'quotePosting');

    expect(result).toStrictEqual({
      ok: false,
      error: "@alice@mastodon.test's server can't quote posts",
    });
  });

  it('refuses without a handle when no such account is signed in', () => {
    const result = requireFeature(contextWith(capsOf('wired', FLAGS)), null, 'localOnlyPosts');

    expect(result).toStrictEqual({ ok: false, error: "This server can't post local-only" });
  });

  it.each(FLAGS)('gives %s a human phrase, never the flag name', (flag) => {
    const result = requireFeature(contextWith(capsOf('mastodon', [])), 'alice', flag);

    const message = result.ok ? '' : result.error;

    expect(result.ok).toBe(false);
    expect(message).toMatch(/^@alice@mastodon\.test's server \(Mastodon\) can't [A-Za-z -]+$/u);
    expect(message).not.toContain(flag);
  });
});
