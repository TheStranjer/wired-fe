/**
 * The words and the transition shared by everything that shows or sets the
 * account plain text posts as (WFE-281, WFE-282): `/postas` and the account
 * picker. Pure: lines to print and the settings patch to dispatch.
 */

import type { AppState } from './appState';
import { type Feeds, setFeedPostAs } from './feeds';
import { postingAccount } from './postingAccount';
import type { Settings } from './settings';
import { t } from '../i18n/translate';
import type { WindowState } from '../windows/model';

/**
 * Who plain text in {@link win} posts as and why, as a line (the reason is the
 * source the resolver names, in words); null when nothing decides it.
 */
export function postingLine(state: AppState, win: WindowState): string | null {
  const posting = postingAccount(state, win);
  if (posting === null) {
    return null;
  }
  return t('state.posting_line', {
    subject: win.ref.kind === 'feed' ? 'feed' : 'plain',
    title: win.title,
    handle: posting.account.handle,
    source: posting.source,
  });
}

/** The line that says {@link handle} is now the default of the feed named {@link feedName}, or the global one when null. */
export function postingSetLine(feedName: string | null, handle: string): string {
  return feedName === null
    ? t('state.posting_set_global', { handle })
    : t('state.posting_set_feed', { feed: feedName, handle });
}

/**
 * The settings patch that makes {@link key} (or nothing) the account the feed
 * {@link feedId} posts as, or the whole client when {@link feedId} is null.
 */
export function postingPatch(
  feeds: Feeds,
  feedId: string | null,
  key: string | null,
): Partial<Settings> {
  if (feedId === null) {
    return { postAs: key };
  }
  return { feeds: setFeedPostAs(feeds, feedId, key ?? undefined) };
}
