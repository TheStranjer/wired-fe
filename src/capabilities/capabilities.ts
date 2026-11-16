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

/** A UI feature WiredFE can switch on (decision 5); never a raw feature string. */
export type FeatureFlag =
  | 'emojiReactions'
  | 'customEmojiReactions'
  | 'chats'
  | 'quotePosting'
  | 'bookmarkFolders'
  | 'editing'
  | 'localOnlyPosts'
  | 'markdown';

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
  ['pleroma_chat_messages', 'chats'],
  ['quote_posting', 'quotePosting'],
  ['pleroma:bookmark_folders', 'bookmarkFolders'],
  ['editing', 'editing'],
];

/** The first of {@link first} and {@link second} that is set, else {@link fallback}. */
function pick<T>(first: T | null | undefined, second: T | null | undefined, fallback: T): T {
  return first ?? second ?? fallback;
}

/** The flags a backend of {@link family} advertises among {@link advertised}. */
function flagsFor(family: Backend, advertised: ReadonlySet<string>): readonly FeatureFlag[] {
  if (!speaksPleromaDialect(family)) {
    return family === 'mastodon' ? ['editing'] : [];
  }
  const advertisedFlags = PLEROMA_FEATURE_FLAGS.filter(([feature]) => advertised.has(feature)).map(
    ([, flag]) => flag,
  );
  return [...advertisedFlags, 'localOnlyPosts', 'markdown'];
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
    features: new Set(flagsFor(backend, advertised)),
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
