/**
 * One post as one scrollback line, IRC style:
 * `[a3] 23:04 <alice@m.example> present day, present time`. Purely
 * presentational: mapping an API Status onto these props is the timeline
 * slice's job; the ui layer never sees API types (AGENTS.md "Layout").
 * A boost adds the dim line of who boosted it above the row, a reply adds
 * who it answers before the body, everything the backend counted sits after
 * the body in {@link PostMeta}, a quote it carries adds the dim ┌ excerpt line
 * under it in {@link QuoteBlock}, and the post's poll and attachments — if it
 * has any — open as lines of their own below it in {@link PollView} and
 * {@link MediaList}.
 */
import type { JSX, Ref } from 'react';

import { BoostLine } from './BoostLine';
import type { EmojiRef } from './emojify';
import type { OpenMedia } from './mediaClick';
import { MediaList } from './MediaList';
import type { MediaItem } from './MediaList';
import { PollView } from './PollView';
import type { PollViewData } from './PollView';
import { PostBody } from './PostBody';
import { PostMeta, type PostMetaProps } from './PostMeta';
import styles from './PostRow.module.css';
import { PostRowHead } from './PostRowHead';
import { QuoteBlock, type QuoteBlockProps } from './QuoteBlock';
import { postArticleProps } from './rowClick';
import type { Via } from './ViaMark';
import type { ClickModifiers } from '../lib/clickModifiers';
import type { ClockFormat } from '../lib/time';

/**
 * Props of {@link PostRow}: what the row itself shows, plus {@link PostMetaProps}
 * — the metadata that goes after the body is exactly what PostMeta takes.
 */
export type PostRowProps = {
  /** The row's DOM node, so the view can keep a new selection in view. */
  readonly ref?: Ref<HTMLElement> | undefined;
  /** The short row label, e.g. "a3"; commands and hotkeys refer to posts by it. */
  readonly label: string;
  /** The moment of the post, shown by {@link Timestamp}. */
  readonly date: Date;
  /** How the clock is rendered. */
  readonly clockFormat: ClockFormat;
  /** The account a multi-account feed's item came through, drawn dim after the
   * clock; null in every other window. */
  readonly via: Via | null;
  /** The author, shown by {@link Nick}. */
  readonly author: {
    readonly handle: string;
    readonly fullHandle: string;
    readonly self: boolean;
  };
  /** Who boosted this post, shown as `⟳ <bob> boosted` above the row; null
   * when nothing boosted it. */
  readonly boostedBy: {
    readonly handle: string;
    readonly fullHandle: string;
  } | null;
  /** Who the post answers, e.g. "@carol" or "a thread"; null when it answers
   * nobody. Shown as `↳ re …: ` before the body. */
  readonly replyTo: string | null;
  /** The post this one quotes, drawn as the dim ┌ excerpt line under it by
   * {@link QuoteBlock}; null when it quotes nothing. */
  readonly quote: QuoteBlockProps | null;
  /** The body as hostile remote HTML; {@link PostBody} sanitizes it. */
  readonly contentHtml: string;
  /** The post's own custom emoji, rendered inline in the body. */
  readonly emojis: readonly EmojiRef[];
  /** The content warning text; the empty string means there is none. */
  readonly spoilerText: string;
  /** Whether a warned body is shown; meaningless without a warning. */
  readonly revealed: boolean;
  /** The post's poll, its option lines below the body; null when the post
   * carries none. Shown by {@link PollView}. */
  readonly poll: PollViewData | null;
  /** The post's attachments, one placeholder line each below the body; empty
   * when it carries none. */
  readonly media: readonly MediaItem[];
  /** Whether the author marked the post sensitive; its media never opens by
   * itself and says so. */
  readonly sensitive: boolean;
  /** Whether media starts open (the reader's `expandMedia` setting). */
  readonly autoExpand: boolean;
  /** Opens the attachment at a zero-based index in the media window (WFE-264);
   * absent leaves every attachment link to the browser. */
  readonly onOpenMedia?: OpenMedia | undefined;
  /** True for the row the user is on; marks it with aria-current. */
  readonly selected: boolean;
  /** Called when the content-warning button is pressed. */
  readonly onToggleReveal: () => void;
  /** Called when the row itself is clicked, not one of its controls. */
  readonly onSelect: () => void;
  /** Called when the row is double-clicked outside its controls: pop its thread out. */
  readonly onPop: () => void;
  /** Called with the click when the nick is clicked. */
  readonly onSelectAuthor: (click: ClickModifiers) => void;
  /** Called with the href of a link in the body that was clicked, and the
   * click; returns true when the app opened it itself, so the browser must not. */
  readonly onContentLink: (href: string, click: ClickModifiers) => boolean;
} & PostMetaProps;

/** The parts of {@link PostRowProps} the post's own line draws: everything but
 * who boosted it above, the poll and media lines below, how the row itself is
 * selected and how it routes clicks, and its DOM node. */
type LineProps = Omit<
  PostRowProps,
  | 'boostedBy'
  | 'poll'
  | 'media'
  | 'sensitive'
  | 'autoExpand'
  | 'onOpenMedia'
  | 'selected'
  | 'onSelect'
  | 'onPop'
  | 'onContentLink'
  | 'ref'
>;

/** The line itself: the label, the clock, the nick, who the post answers, its
 * body, everything the backend counted after it and its quote's ┌ line below. */
function PostLine(props: LineProps): JSX.Element {
  const { spoilerText, revealed, visibility, counts, mine, reactions, edited, onToggleReveal } =
    props;

  return (
    <>
      <PostRowHead
        author={props.author}
        clockFormat={props.clockFormat}
        date={props.date}
        label={props.label}
        onSelectAuthor={props.onSelectAuthor}
        replyTo={props.replyTo}
        via={props.via}
      />
      <PostBody
        contentHtml={props.contentHtml}
        emojis={props.emojis}
        hasQuoteCard={props.quote !== null}
        spoilerText={spoilerText}
        revealed={revealed}
        onToggleReveal={onToggleReveal}
      />
      <PostMeta
        counts={counts}
        edited={edited}
        mine={mine}
        reactions={reactions}
        visibility={visibility}
      />
      {props.quote === null ? undefined : <QuoteBlock {...props.quote} />}
    </>
  );
}

/** One post as a chat line; clicking the row selects it, clicking the nick opens the author. */
export function PostRow(props: PostRowProps): JSX.Element {
  const { boostedBy, poll, media, sensitive, autoExpand, onOpenMedia, selected, ref, ...line } =
    props;
  const { onSelect, onPop, onContentLink } = line;

  return (
    <article
      {...postArticleProps({
        label: line.label,
        fullHandle: line.author.fullHandle,
        selected,
        onSelect,
        onPop,
        onContentLink,
      })}
      className={[styles['row'], selected ? styles['selected'] : undefined].join(' ')}
      ref={ref}
    >
      {boostedBy === null ? undefined : <BoostLine boostedBy={boostedBy} />}
      <PostLine {...line} />
      {poll === null ? undefined : (
        <PollView clockFormat={line.clockFormat} label={line.label} poll={poll} />
      )}
      <MediaList
        autoExpand={autoExpand}
        items={media}
        onOpenMedia={onOpenMedia}
        sensitive={sensitive}
      />
    </article>
  );
}
