/**
 * The `feed` window kind (decision 14): a saved feed's merged stream — every
 * source of the feed, each read as its own account, newest first — its pages
 * pulled by ./useFeed and its lines drawn by the shared scrollback
 * (src/views/BufferView). The ref's target is the feed's id and its title the
 * feed's name (`~main`); the topic line adds `, posting as @handle` while a
 * posting account resolves (WFE-285). A feed window belongs to no account, so
 * plain text typed in it posts as the feed's posting account
 * (src/state/postAccountless): the feed's default, the global one, the only
 * account, or the one the reader picks in the account picker (WFE-284).
 */

import type { JSX } from 'react';

import { useFeed } from './useFeed';
import { useT } from '../../i18n/I18nProvider';
import { t } from '../../i18n/translate';
import { postAccountless } from '../../state/postAccountless';
import { postingAccount } from '../../state/postingAccount';
import type { WindowKindDefinition } from '../../state/windowKind';
import { BufferView } from '../../views/BufferView';

/** The feed window: its buffer's lines, kept full by the feed's sources. */
function FeedWindow({ windowId }: { readonly windowId: string }): JSX.Element {
  useFeed(windowId);
  const label = useT()('features.feed.log_label');
  return <BufferView label={label} windowId={windowId} />;
}

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'feed',
  topic: (window, state) => {
    const posting = postingAccount(state, window);
    return posting === null
      ? window.title
      : t('features.feed.topic_posting', {
          title: window.title,
          handle: posting.account.handle,
        });
  },
  Component: FeedWindow,
  onPost: postAccountless,
};
