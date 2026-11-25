/**
 * The parts of a post card above its content (decision 15): the framed top
 * line with the label and the clock, who boosted the post, and the author's
 * name and handle. Split out of {@link PostCard}, which lays them out.
 */
import type { JSX } from 'react';

import { Avatar } from './Avatar';
import { BoostLine } from './BoostLine';
import { Nick } from './Nick';
import styles from './PostCard.module.css';
import type { PostCardProps } from './postCardTypes';
import { RemoteHtml } from './RemoteHtml';
import { Timestamp } from './Timestamp';
import { escapeHtml } from '../lib/escapeHtml';

/** The top line of the frame: the label on the left, the clock on the right. */
export function CardHead(
  props: Pick<PostCardProps, 'label' | 'date' | 'clockFormat' | 'selected'>,
): JSX.Element {
  const { label, date, clockFormat, selected } = props;
  const labelClass = [styles['label'], selected ? styles['labelSelected'] : undefined].join(' ');
  return (
    <div className={styles['head']}>
      <span className={labelClass}>{`[${label}]`}</span>
      <Timestamp date={date} format={clockFormat} />
    </div>
  );
}

/** Who boosted the post, with their small picture when avatars show. */
export function CardBoost(
  props: Pick<PostCardProps, 'boostedBy' | 'showAvatar'>,
): JSX.Element | null {
  const { boostedBy, showAvatar } = props;
  if (boostedBy === null) {
    return null;
  }
  return (
    <div className={styles['boost']}>
      {showAvatar ? (
        <Avatar
          animate={false}
          handle={boostedBy.fullHandle}
          size="small"
          src={boostedBy.avatar.src}
          staticSrc={boostedBy.avatar.staticSrc}
        />
      ) : undefined}
      <BoostLine boostedBy={boostedBy} />
    </div>
  );
}

/** The author's display name (custom emoji included) over their handle, and
 * who the post answers. */
export function CardIdentity(
  props: Pick<PostCardProps, 'author' | 'replyTo' | 'onSelectAuthor'>,
): JSX.Element {
  const { author, replyTo, onSelectAuthor } = props;
  const name = author.displayName === '' ? author.handle : author.displayName;
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
          <span className={styles['reply']}>{` ↳ re ${replyTo}`}</span>
        )}
      </div>
    </>
  );
}
