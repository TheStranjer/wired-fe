/**
 * Capabilities for tests of what a backend does and does not offer (WFE-172):
 * any set of flags on any backend, and two ready-made instances — a Mastodon
 * with editing and quote posts, and a Wired with every flag. They live here,
 * not in src/test, because the test-support layer may not reach this one.
 */
import type { Backend } from './backend';
import {
  type Capabilities,
  DEFAULT_POLL_LIMITS,
  FEATURE_FLAGS,
  type FeatureFlag,
} from './capabilities';
import { NO_ANONYMOUS_READS } from '../api/schemas/anonymousReads';

/** Capabilities of a {@link backend} carrying exactly {@link flags}. */
export function capabilitiesOn(backend: Backend, flags: readonly FeatureFlag[]): Capabilities {
  return {
    backend,
    maxCharacters: 500,
    maxMediaAttachments: 4,
    pollLimits: DEFAULT_POLL_LIMITS,
    features: new Set(flags),
    anonymousReads: NO_ANONYMOUS_READS,
  };
}

/** What a Mastodon with quote posts can do: no reactions, no local posts, no reset API. */
export const MASTODON_CAPABILITIES: Capabilities = capabilitiesOn('mastodon', [
  'editing',
  'quotePosting',
]);

/** What a Wired can do: everything. */
export const WIRED_CAPABILITIES: Capabilities = capabilitiesOn('wired', FEATURE_FLAGS);
