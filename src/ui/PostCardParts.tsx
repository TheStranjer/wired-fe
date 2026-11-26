/**
 * The part of a post card above its content that names the author (decision
 * 15): their display name and handle, and who the post answers. Split out of
 * {@link PostCard}, which lays it out. In a DM window the name is `you` for the
 * viewer's own bubble, and a bubble that follows the same author's within
 * minutes leaves the whole identity out (WFE-234).
 */
import type { JSX } from 'react';

import { bubbleName } from './cardDm';
import { Nick } from './Nick';
import styles from './PostCard.module.css';
import type { PostCardProps } from './postCardTypes';
import { RemoteHtml } from './RemoteHtml';
import { useT } from '../i18n/I18nProvider';
import { escapeHtml } from '../lib/escapeHtml';

/** The author's display name (custom emoji included) over their handle, and
 * who the post answers. */
export function CardIdentity(
  props: Pick<PostCardProps, 'author' | 'replyTo' | 'onSelectAuthor' | 'chat'>,
): JSX.Element | null {
  const { author, replyTo, onSelectAuthor, chat } = props;
  const t = useT();
  if (chat?.collapsed === true) {
    return null;
  }
  const name = bubbleName(chat, author.displayName === '' ? author.handle : author.displayName);
  return (
    <>
      <div className={styles['name']}>
        <RemoteHtml emojis={author.displayNameEmojis} html={escapeHtml(name)} inline />
      </div>
      <div className={styles['handle']}>
        <Nick
          fullHandle={author.fullHandle}
          handle={author.fullHandle}
          onSelect={onSelectAuthor}
          self={author.self}
        />
        {replyTo === null ? undefined : (
          <span className={styles['reply']}>
            {` ${t('ui.post_card_parts.reply_to', { label: replyTo })}`}
          </span>
        )}
      </div>
    </>
  );
}
