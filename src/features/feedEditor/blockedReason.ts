/**
 * Why a source of an account cannot be ticked in the feed editor (decision 5
 * and 14), or null when it can. Every source the editor offers is one the
 * Mastodon API of every backend serves, so the only thing that stops an
 * account is its sign-in: once its token was refused and could not be
 * refreshed, nothing can be read as it. The reason is written into the name of
 * the checkbox.
 */

import { t } from '../../i18n/translate';

/** The reason the account {@link accountKey} cannot be read, or null when it can. */
export function blockedReason(accountKey: string, expired: ReadonlySet<string>): string | null {
  return expired.has(accountKey) ? t('features.feed_editor.sign_in_expired') : null;
}
