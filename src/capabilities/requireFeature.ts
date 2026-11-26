/**
 * The one capability gate (decision 5): a command asks {@link requireFeature}
 * whether the acting account's instance carries a flag and gets either the
 * instance's {@link Capabilities} or the refusal to print. Every refusal reads
 * the same way and never shows the raw flag name: "@alice@mastodon.test's
 * server (Mastodon) can't react to posts with emoji". Instances whose
 * capabilities were never read refuse as though the flag were absent; no
 * endpoint is trusted there.
 */

import type { Backend } from './backend';
import { type Capabilities, type FeatureFlag, hasFeature } from './capabilities';
import type { MessageKey } from '../i18n/messages';
import { t } from '../i18n/translate';
import { type Result, err, ok } from '../lib/result';

/**
 * The part of the app state the gate reads: the signed-in accounts and what
 * each origin turned out to be. Structural, so this layer need not import the
 * state layer; the app state and every command context satisfy it.
 */
type FeatureContext = {
  readonly state: {
    readonly accounts: readonly {
      readonly key: string;
      readonly origin: string;
      readonly handle: string;
    }[];
    readonly profiles: ReadonlyMap<string, { readonly capabilities: Capabilities | null }>;
  };
};

/** The catalog message that refuses each flag, a whole sentence naming the server and what it cannot do. */
const FEATURE_MESSAGES: Readonly<Record<FeatureFlag, MessageKey>> = {
  emojiReactions: 'capabilities.cannot.emoji_reactions',
  customEmojiReactions: 'capabilities.cannot.custom_emoji_reactions',
  quotePosting: 'capabilities.cannot.quote_posting',
  editing: 'capabilities.cannot.editing',
  localOnlyPosts: 'capabilities.cannot.local_only_posts',
  markdown: 'capabilities.cannot.markdown',
  passwordResetApi: 'capabilities.cannot.password_reset_api',
  settingsStore: 'capabilities.cannot.settings_store',
};

/** How a backend family is named on screen; null where the family says nothing. */
function backendName(backend: Backend): string | null {
  switch (backend) {
    case 'wired':
      return 'Wired';
    case 'pleroma':
      return 'Pleroma';
    case 'akkoma':
      return 'Akkoma';
    case 'mastodon':
      return 'Mastodon';
    case 'unknown':
      return null;
  }
}

/** The refusal of {@link flag} for {@link handle}'s server of {@link capabilities}. */
function refusal(
  flag: FeatureFlag,
  handle: string | null,
  capabilities: Capabilities | null,
): string {
  const name = capabilities === null ? null : backendName(capabilities.backend);
  return t(FEATURE_MESSAGES[flag], {
    owner: handle === null ? 'none' : 'handle',
    handle: handle ?? '',
    brand: name === null ? '' : ` (${name})`,
  });
}

/**
 * The capabilities of {@link accountKey}'s instance when it carries
 * {@link flag}, else the human refusal to show the reader.
 */
export function requireFeature(
  context: FeatureContext,
  accountKey: string | null,
  flag: FeatureFlag,
): Result<Capabilities, string> {
  const { accounts, profiles } = context.state;
  const account = accounts.find((candidate) => candidate.key === accountKey) ?? null;
  const capabilities =
    account === null ? null : (profiles.get(account.origin)?.capabilities ?? null);
  if (capabilities === null || !hasFeature(capabilities, flag)) {
    return err(refusal(flag, account?.handle ?? null, capabilities));
  }
  return ok(capabilities);
}
