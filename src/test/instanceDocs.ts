/**
 * Instance documents for the capability tests (decision 5): NodeInfo, v1 and
 * v2 documents in their parsed internal shape, each with every field set to a
 * neutral value the tests override.
 */
import { NO_ANONYMOUS_READS } from '../api/schemas/anonymousReads';
import type { InstanceV1 } from '../api/schemas/instanceV1';
import type { InstanceV2 } from '../api/schemas/instanceV2';
import type { NodeInfo } from '../api/schemas/nodeinfo';

/** The feature strings a full Wired instance advertises. */
export const WIRED_FEATURES: readonly string[] = [
  'pleroma_api',
  'mastodon_api',
  'pleroma_emoji_reactions',
  'pleroma_custom_emoji_reactions',
  'editing',
  'quote_posting',
];

/** The post formats a Wired instance lists in `pleroma.metadata.post_formats`. */
export const MARKDOWN_FORMATS: readonly string[] = ['text/plain', 'text/html', 'text/markdown'];

/** A NodeInfo document naming {@link name} and advertising {@link features}. */
export function nodeInfoNamed(
  name: string,
  features: readonly string[] = WIRED_FEATURES,
): NodeInfo {
  return {
    version: '2.1',
    software: { name, version: '1.0.0' },
    openRegistrations: false,
    features,
    nodeName: 'test.example',
    anonymousReads: NO_ANONYMOUS_READS,
  };
}

/** A v1 document with the given limits and advertised features. */
export function v1Doc(overrides: Partial<InstanceV1> = {}): InstanceV1 {
  return {
    title: 'Test',
    version: '1.0.0',
    maxCharacters: null,
    maxMediaAttachments: null,
    pollLimits: null,
    features: [],
    postFormats: [],
    ...overrides,
  };
}

/** A v2 document with the given limits. */
export function v2Doc(overrides: Partial<InstanceV2> = {}): InstanceV2 {
  return {
    title: 'Test',
    version: '4.0.0',
    mastodonApiVersion: 1,
    maxCharacters: null,
    maxMediaAttachments: null,
    pollLimits: null,
    anonymousReads: NO_ANONYMOUS_READS,
    ...overrides,
  };
}
