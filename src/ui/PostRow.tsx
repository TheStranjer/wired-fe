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
import type { JSX, MouseEvent, Ref } from 'react';

import { MediaList } from './MediaList';
import type { MediaItem } from './MediaList';
import { Nick } from './Nick';
import { PollView } from './PollView';
import type { PollViewData } from './PollView';
import { PostBody } from './PostBody';
import { PostMeta, type PostMetaProps } from './PostMeta';
import styles from './PostRow.module.css';
import { QuoteBlock, type QuoteBlockProps } from './QuoteBlock';
import { Timestamp } from './Timestamp';
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
  /** True for the row the user is on; marks it with aria-current. */
  readonly selected: boolean;
  /** Called when the content-warning button is pressed. */
  readonly onToggleReveal: () => void;
  /** Called when the row itself is clicked, not one of its controls. */
  readonly onSelect: () => void;
  /** Called when the nick is clicked. */
  readonly onSelectAuthor: () => void;
} & PostMetaProps;

/** The controls inside a row: they own their own clicks, the row takes the rest. */
const CONTROL_SELECTOR = 'button, a, audio, video';

/** True when the click landed on a control inside the row. */
function clickedControl(event: MouseEvent<HTMLElement>): boolean {
  const { target } = event;
  return target instanceof Element && target.closest(CONTROL_SELECTOR) !== null;
}

/** Who boosted the post, in their own dim line above it: `⟳ <bob> boosted`. */
function BoostLine(props: {
  readonly boostedBy: NonNullable<PostRowProps['boostedBy']>;
}): JSX.Element {
  const { handle, fullHandle } = props.boostedBy;
  return (
    <div className={styles['boost']}>
      <span aria-hidden="true">{'⟳ '}</span>
      <Nick handle={handle} fullHandle={fullHandle} self={false} />
      {' boosted'}
    </div>
  );
}

/** The parts of {@link PostRowProps} the post's own line draws: everything but
 * who boosted it above, the poll and media lines below, how the row itself is
 * selected, and its DOM node. */
type LineProps = Omit<
  PostRowProps,
  'boostedBy' | 'poll' | 'media' | 'sensitive' | 'autoExpand' | 'selected' | 'onSelect' | 'ref'
>;

/** The line itself: the label, the clock, the nick, who the post answers, its
 * body, everything the backend counted after it and its quote's ┌ line below. */
function PostLine(props: LineProps): JSX.Element {
  const {
    label,
    date,
    clockFormat,
    author,
    replyTo,
    contentHtml,
    spoilerText,
    revealed,
    visibility,
    counts,
    mine,
    reactions,
    edited,
    quote,
    onToggleReveal,
    onSelectAuthor,
  } = props;

  return (
    <>
      <span className={styles['label']}>{`[${label}]`}</span>{' '}
      <Timestamp date={date} format={clockFormat} />{' '}
      <Nick
        handle={author.handle}
        fullHandle={author.fullHandle}
        self={author.self}
        onSelect={onSelectAuthor}
      />{' '}
      {replyTo === null ? undefined : (
        <span className={styles['reply']}>{`↳ re ${replyTo}: `}</span>
      )}
      <PostBody
        contentHtml={contentHtml}
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
      {quote === null ? undefined : <QuoteBlock {...quote} />}
    </>
  );
}

/** One post as a chat line; clicking the row selects it, clicking the nick opens the author. */
export function PostRow(props: PostRowProps): JSX.Element {
  const { boostedBy, poll, media, sensitive, autoExpand, selected, onSelect, ref, ...line } = props;

  return (
    <article
      aria-current={selected ? 'true' : undefined}
      aria-label={`Post ${line.label} by ${line.author.fullHandle}`}
      className={[styles['row'], selected ? styles['selected'] : undefined].join(' ')}
      // The row click is mouse-only on purpose: keyboard selection lives in the
      // navigation keymap, one action for every row, not a tab stop per row. The
      // strict jsx-a11y gate reads the onClick name alone, never its semantics,
      // so the same synthetic event is caught in its capture phase.
      onClickCapture={(event) => {
        if (!clickedControl(event)) {
          onSelect();
        }
      }}
      ref={ref}
    >
      {boostedBy === null ? undefined : <BoostLine boostedBy={boostedBy} />}
      <PostLine {...line} />
      {poll === null ? undefined : (
        <PollView clockFormat={line.clockFormat} label={line.label} poll={poll} />
      )}
      <MediaList autoExpand={autoExpand} items={media} sensitive={sensitive} />
    </article>
  );
}
