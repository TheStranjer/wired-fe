/**
 * The feed editor window (decision 14): finds the feed its window's target
 * names — a new one for the target `new` — and shows its editor. A feed that is
 * gone, deleted from the command line while the editor was open, is said so.
 */

import type { JSX } from 'react';

import { FeedEditor } from './FeedEditor';
import styles from './FeedEditor.module.css';
import { useT } from '../../i18n/I18nProvider';
import { NEW_FEED_TARGET } from '../../state/feedEditorWindow';
import { feedById } from '../../state/feeds';
import { useAppState } from '../../state/StateContext';

/** The editor of the feed window {@link props.windowId} targets, or a notice that the feed is gone. */
export function FeedEditorWindow(props: { readonly windowId: string }): JSX.Element {
  const { windows, settings } = useAppState();
  const t = useT();
  const target =
    windows.windows.find((win) => win.id === props.windowId)?.ref.target ?? NEW_FEED_TARGET;
  const feed = target === NEW_FEED_TARGET ? null : feedById(settings.feeds, target);
  if (feed === undefined) {
    return <p className={styles['notice']}>{t('features.feed_editor.gone')}</p>;
  }
  return <FeedEditor windowId={props.windowId} feed={feed} />;
}
