/**
 * One post drawn as a card (decision 15), the twin of {@link PostRow}: a dim
 * frame whose top line carries the label `[a3]` and the clock, the author's
 * avatar beside their display name and handle, then the body, quote, poll,
 * attachments and metadata, all in the same parts the row uses. Purely
 * presentational, with the same props as the row plus the avatars, the display
 * name and whether avatars and images show; without images the attachments are
 * the row's placeholder lines. A boost adds who boosted it above the author.
 */
import type { JSX } from 'react';

import { Avatar } from './Avatar';
import { CardBoost } from './CardBoost';
import { bubbleName, cardClassKeys, dmStrip } from './cardDm';
import type { ChatMark, DmRecipient } from './cardDm';
import { CardHead } from './CardHead';
import type { EmojiRef } from './emojify';
import { MediaGrid } from './MediaGrid';
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
  /** Whether media draws as a grid; false leaves the IRC placeholder lines. */
  readonly showImages: boolean;
  /** The accounts a direct message names besides its author, for its header strip. */
  readonly recipients: readonly DmRecipient[];
  /** The bubble placement in a DM window; null for a card anywhere else. */
  readonly chat: ChatMark | null;
};

/** The author's display name (custom emoji included) over their handle, and
 * who the post answers. */
function CardIdentity(
  props: Pick<PostCardProps, 'author' | 'replyTo' | 'onSelectAuthor' | 'chat'>,
): JSX.Element | null {
  const { author, replyTo, onSelectAuthor, chat } = props;
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
      {props.showImages ? (
        <MediaGrid
          autoExpand={props.autoExpand}
          items={media}
          sensitive={props.sensitive}
          warned={spoilerText !== '' && !revealed}
        />
      ) : (
        <MediaList autoExpand={props.autoExpand} items={media} sensitive={props.sensitive} />
      )}
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

/** The author's picture beside the text; a chat bubble goes without one. */
function CardAvatar(
  props: Pick<PostCardProps, 'author' | 'showAvatar' | 'chat'>,
): JSX.Element | null {
  const { author, showAvatar, chat } = props;
  if (!showAvatar || chat !== null) {
    return null;
  }
  return (
    <Avatar
      animate={false}
      handle={author.fullHandle}
      size="medium"
      src={author.avatar.src}
      staticSrc={author.avatar.staticSrc}
    />
  );
}

/** One post as a card; clicking it selects it, clicking the nick opens the author. */
export function PostCard(props: PostCardProps): JSX.Element {
  const { author, selected, chat, ref } = props;
  return (
    <article
      {...postArticleProps({
        label: props.label,
        fullHandle: author.fullHandle,
        selected,
        direct: props.visibility === 'direct',
        onSelect: props.onSelect,
        onContentLink: props.onContentLink,
      })}
      className={cardClassKeys(props, selected)
        .map((key) => styles[key])
        .join(' ')}
      ref={ref}
    >
      <CardHead
        clockFormat={props.clockFormat}
        date={props.date}
        dm={dmStrip(props)}
        label={props.label}
        selected={selected}
      />
      <CardBoost boostedBy={props.boostedBy} showAvatar={props.showAvatar} />
      <div className={styles['main']}>
        <CardAvatar author={author} chat={chat} showAvatar={props.showAvatar} />
        <div className={styles['text']}>
          <CardIdentity
            author={author}
            chat={chat}
            onSelectAuthor={props.onSelectAuthor}
            replyTo={props.replyTo}
          />
          <CardContent {...props} />
        </div>
      </div>
    </article>
  );
}
