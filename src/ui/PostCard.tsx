/**
 * One post drawn as a card (decision 15), the twin of {@link PostRow}: a dim
 * frame whose top line carries the label `[a3]` and the clock, the author's
 * avatar beside their display name and handle, then the body, quote, poll,
 * attachments and metadata, all in the same parts the row uses. Purely
 * presentational, with the same props as the row plus the avatars, the display
 * name and whether avatars show at all. A boost adds who boosted it above the
 * author. There is no action bar yet.
 */
import type { JSX } from 'react';

import { Avatar } from './Avatar';
import { BoostLine } from './BoostLine';
import type { EmojiRef } from './emojify';
import { MediaList } from './MediaList';
import { Nick } from './Nick';
import { PollView } from './PollView';
import { PostBody } from './PostBody';
import styles from './PostCard.module.css';
import { PostMeta } from './PostMeta';
import type { PostRowProps } from './PostRow';
import { QuoteBlock } from './QuoteBlock';
import { RemoteHtml } from './RemoteHtml';
import { postArticleProps } from './rowClick';
import { Timestamp } from './Timestamp';
import { escapeHtml } from '../lib/escapeHtml';

/** An account's picture URLs: the (maybe animated) image and its still. */
type AvatarUrls = { readonly src: string; readonly staticSrc: string };

/** Props of {@link PostCard}: the row's props, with the author and the booster
 * carrying their pictures, the author a display name, and a switch for avatars. */
export type PostCardProps = Omit<PostRowProps, 'author' | 'boostedBy'> & {
  /** The author: the row's nick data, their picture and their display name. */
  readonly author: PostRowProps['author'] & {
    readonly avatar: AvatarUrls;
    /** The name as plain text; may hold `:shortcode:` custom emoji. */
    readonly displayName: string;
    /** The custom emoji the display name may use. */
    readonly displayNameEmojis: readonly EmojiRef[];
  };
  /** Who boosted the post, with their picture; null when nothing boosted it. */
  readonly boostedBy:
    (NonNullable<PostRowProps['boostedBy']> & { readonly avatar: AvatarUrls }) | null;
  /** Whether avatars show; false leaves the card text-only. */
  readonly showAvatar: boolean;
};

/** The top line of the frame: the label on the left, the clock on the right. */
function CardHead(
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
function CardBoost(props: Pick<PostCardProps, 'boostedBy' | 'showAvatar'>): JSX.Element | null {
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
function CardIdentity(
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

/** Everything under the identity: the body, its metadata, the quote, the poll
 * and the attachments. */
function CardContent(props: PostCardProps): JSX.Element {
  const { quote, poll, media, spoilerText, revealed, onToggleReveal } = props;
  return (
    <>
      <div className={styles['body']}>
        <PostBody
          contentHtml={props.contentHtml}
          emojis={props.emojis}
          hasQuoteCard={quote !== null}
          onToggleReveal={onToggleReveal}
          revealed={revealed}
          spoilerText={spoilerText}
        />
      </div>
      {quote === null ? undefined : <QuoteBlock {...quote} />}
      {poll === null ? undefined : (
        <PollView clockFormat={props.clockFormat} label={props.label} poll={poll} />
      )}
      <MediaList autoExpand={props.autoExpand} items={media} sensitive={props.sensitive} />
      <PostMeta
        counts={props.counts}
        edited={props.edited}
        mine={props.mine}
        reactions={props.reactions}
        visibility={props.visibility}
      />
    </>
  );
}

/** One post as a card; clicking it selects it, clicking the nick opens the author. */
export function PostCard(props: PostCardProps): JSX.Element {
  const { author, selected, showAvatar, ref } = props;
  const { avatar } = author;
  return (
    <article
      {...postArticleProps({
        label: props.label,
        fullHandle: author.fullHandle,
        selected,
        onSelect: props.onSelect,
        onContentLink: props.onContentLink,
      })}
      className={[styles['card'], selected ? styles['selected'] : undefined].join(' ')}
      ref={ref}
    >
      <CardHead
        clockFormat={props.clockFormat}
        date={props.date}
        label={props.label}
        selected={selected}
      />
      <CardBoost boostedBy={props.boostedBy} showAvatar={showAvatar} />
      <div className={styles['main']}>
        {showAvatar ? (
          <Avatar
            animate={false}
            handle={author.fullHandle}
            size="medium"
            src={avatar.src}
            staticSrc={avatar.staticSrc}
          />
        ) : undefined}
        <div className={styles['text']}>
          <CardIdentity
            author={author}
            onSelectAuthor={props.onSelectAuthor}
            replyTo={props.replyTo}
          />
          <CardContent {...props} />
        </div>
      </div>
    </article>
  );
}
