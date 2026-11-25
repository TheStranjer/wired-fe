/**
 * One post drawn as a card (decision 15), the twin of {@link PostRow}: a dim
 * frame whose top line carries the label `[a3]` and the clock, the author's
 * avatar beside their display name and handle, then the body, quote, poll,
 * attachments and metadata, all in the same parts the row uses. Purely
 * presentational, with the same props as the row plus the avatars, the display
 * name, whether avatars and images show and the action bar's command lines;
 * without images the attachments are the row's placeholder lines. A boost adds
 * who boosted it above the author. The bar of {@link PostActions} closes the
 * card and carries the tallies; the audience, the reactions and the edit mark
 * stay above it in {@link PostMeta}.
 */
import type { JSX } from 'react';

import { Avatar } from './Avatar';
import { CardBoost } from './CardBoost';
import { cardClassKeys, dmStrip } from './cardDm';
import { CardHead } from './CardHead';
import { MediaGrid } from './MediaGrid';
import { MediaList } from './MediaList';
import { PollView } from './PollView';
import { PostActions } from './PostActions';
import { PostBody } from './PostBody';
import styles from './PostCard.module.css';
import { CardIdentity } from './PostCardParts';
import type { PostCardProps } from './postCardTypes';
import { PostMeta } from './PostMeta';
import { QuoteBlock } from './QuoteBlock';
import { postArticleProps } from './rowClick';

export type { PostCardProps } from './postCardTypes';

/** No tallies: the action bar carries them, so the metadata line leaves them out. */
const NO_COUNTS = { replies: 0, boosts: 0, favourites: 0 };

/** No marks of the viewer's own: the action bar's pressed buttons show them. */
const NO_MARKS = { boosted: false, favourited: false, bookmarked: false };

/** Everything under the identity: the body, the quote, the poll, the
 * attachments, the metadata and the action bar. */
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
      <div className={styles['meta']}>
        <PostMeta
          counts={NO_COUNTS}
          edited={props.edited}
          mine={NO_MARKS}
          reactions={props.reactions}
          visibility={props.visibility}
        />
      </div>
      <PostActions
        counts={props.counts}
        label={props.label}
        lines={props.actionLines}
        mine={props.mine}
        onAction={props.onAction}
        own={props.author.self}
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
        onPop: props.onPop,
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
        via={props.via}
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
