/**
 * The one typed Capabilities object built on connect (decision 5): limits
 * from the v2 and v1 instance documents, feature flags from the feature
 * strings the backend advertises in its NodeInfo metadata and, on the Pleroma
 * dialect, in `pleroma.metadata.features` of v1. Everything above this layer
 * checks these flags and never the backend's name; a flag whose endpoint later
 * answers 404/501 is dropped by its caller with {@link withoutFeature}.
 */
import { type Backend, identifyBackend, speaksPleromaDialect } from './backend';
import type { InstanceV1 } from '../api/schemas/instanceV1';
import type { InstanceV2 } from '../api/schemas/instanceV2';
import type { NodeInfo } from '../api/schemas/nodeinfo';
import type { PollLimits } from '../api/schemas/pollLimits';

/** Every UI feature WiredFE can switch on, for code that has to check a stored flag. */
export const FEATURE_FLAGS = [
  'emojiReactions',
  'customEmojiReactions',
  'quotePosting',
  'editing',
  'localOnlyPosts',
  'markdown',
  'passwordResetApi',
  'settingsStore',
] as const;

/** A UI feature WiredFE can switch on (decision 5); never a raw feature string. */
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

/** What the connected instance can do and how far it lets posts reach. */
export type Capabilities = {
  readonly backend: Backend;
  readonly maxCharacters: number;
  readonly maxMediaAttachments: number;
  readonly pollLimits: PollLimits;
  readonly features: ReadonlySet<FeatureFlag>;
};

/** The poll limits of an instance that advertises none: Mastodon's defaults. */
export const DEFAULT_POLL_LIMITS: PollLimits = {
  maxOptions: 4,
  maxCharactersPerOption: 50,
  minExpiration: 300,
  maxExpiration: 2629746,
};

/** The post length of an instance that advertises none: Mastodon's classic 500. */
const DEFAULT_MAX_CHARACTERS = 500;

/** The attachment count of an instance that advertises none; the shell's fallback too (WFE-126). */
export const DEFAULT_MAX_MEDIA_ATTACHMENTS = 4;

/** Feature strings of the Pleroma dialect that turn on a flag when advertised. */
const PLEROMA_FEATURE_FLAGS: readonly (readonly [string, FeatureFlag])[] = [
  ['pleroma_emoji_reactions', 'emojiReactions'],
  ['pleroma_custom_emoji_reactions', 'customEmojiReactions'],
  ['quote_posting', 'quotePosting'],
  ['editing', 'editing'],
];

/** The first Mastodon API version (4.5) that accepts `quoted_status_id` (FEP-044f). */
const MASTODON_QUOTE_API_VERSION = 7;

/** The post format whose advertisement turns on {@link FeatureFlag} `markdown`. */
const MARKDOWN_FORMAT = 'text/markdown';

/** The first of {@link first} and {@link second} that is set, else {@link fallback}. */
function pick<T>(first: T | null | undefined, second: T | null | undefined, fallback: T): T {
  return first ?? second ?? fallback;
}

/** The flags of a Mastodon: editing always, quoting from API version 7 on (4.5). */
function mastodonFlags(v2: InstanceV2 | null): readonly FeatureFlag[] {
  const quotes = (v2?.mastodonApiVersion ?? 0) >= MASTODON_QUOTE_API_VERSION;
  return quotes ? ['editing', 'quotePosting'] : ['editing'];
}

/**
 * The flags of the Pleroma dialect: what it advertises among {@link advertised},
 * `markdown` iff its v1 `post_formats` lists it, and `localOnlyPosts` and
 * `passwordResetApi` always — no document says whether either works, but
 * Wired, Pleroma and Akkoma all do (the reset is `/api/v1/pleroma/password_reset`
 * or `/auth/password`; Mastodon has no such API), so the whole dialect is
 * assumed to. `settingsStore` (`/api/v1/pleroma/settings/:app`) is likewise
 * always present: Wired serves it and Pleroma and Akkoma have for longer than
 * any version supported.
 */
function pleromaFlags(
  advertised: ReadonlySet<string>,
  v1: InstanceV1 | null,
): readonly FeatureFlag[] {
  const advertisedFlags = PLEROMA_FEATURE_FLAGS.filter(([feature]) => advertised.has(feature)).map(
    ([, flag]) => flag,
  );
  const markdown: readonly FeatureFlag[] =
    v1?.postFormats.includes(MARKDOWN_FORMAT) === true ? ['markdown'] : [];
  return [...advertisedFlags, 'localOnlyPosts', 'passwordResetApi', 'settingsStore', ...markdown];
}

/** The flags a backend of {@link family} has, from the documents it answered. */
function flagsFor(
  family: Backend,
  advertised: ReadonlySet<string>,
  docs: { readonly v1: InstanceV1 | null; readonly v2: InstanceV2 | null },
): readonly FeatureFlag[] {
  if (speaksPleromaDialect(family)) {
    return pleromaFlags(advertised, docs.v1);
  }
  return family === 'mastodon' ? mastodonFlags(docs.v2) : [];
}

/** Builds the {@link Capabilities} from the documents read on connect (decision 5). */
export function deriveCapabilities(input: {
  readonly nodeInfo: NodeInfo;
  readonly v1: InstanceV1 | null;
  readonly v2: InstanceV2 | null;
}): Capabilities {
  const { nodeInfo, v1, v2 } = input;
  const backend = identifyBackend(nodeInfo);
  const advertised = new Set<string>([...nodeInfo.features, ...(v1?.features ?? [])]);
  return {
    backend,
    maxCharacters: pick(v2?.maxCharacters, v1?.maxCharacters, DEFAULT_MAX_CHARACTERS),
    maxMediaAttachments: pick(
      v2?.maxMediaAttachments,
      v1?.maxMediaAttachments,
      DEFAULT_MAX_MEDIA_ATTACHMENTS,
    ),
    pollLimits: pick(v2?.pollLimits, v1?.pollLimits, DEFAULT_POLL_LIMITS),
    features: new Set(flagsFor(backend, advertised, { v1, v2 })),
  };
}

/** Whether {@link capabilities} carries {@link flag}. */
export function hasFeature(capabilities: Capabilities, flag: FeatureFlag): boolean {
  return capabilities.features.has(flag);
}

/**
 * {@link capabilities} without {@link flag}, for a feature that advertised
 * itself but answers 404/501 (decision 5). The same object when it already
 * lacked the flag.
 */
export function withoutFeature(capabilities: Capabilities, flag: FeatureFlag): Capabilities {
  if (!capabilities.features.has(flag)) {
    return capabilities;
  }
  const features = new Set(capabilities.features);
  features.delete(flag);
  return { ...capabilities, features };
}
