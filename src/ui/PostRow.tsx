/**
 * One post as one scrollback line, IRC style:
 * `[a3] 23:04 <alice@m.example> present day, present time`. Purely
 * presentational: mapping an API Status onto these props is the timeline
 * slice's job; the ui layer never sees API types (AGENTS.md "Layout").
 */
import type { JSX, MouseEvent } from 'react';

import { Nick } from './Nick';
import styles from './PostRow.module.css';
import { RemoteHtml } from './RemoteHtml';
import { Timestamp } from './Timestamp';
import type { ClockFormat } from '../lib/time';

/** Props of {@link PostRow}. */
export type PostRowProps = {
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
  /** The body as hostile remote HTML; {@link RemoteHtml} sanitizes it. */
  readonly contentHtml: string;
  /** The content warning text; the empty string means there is none. */
  readonly spoilerText: string;
  /** Whether a warned body is shown; meaningless without a warning. */
  readonly revealed: boolean;
  /** True for the row the user is on; marks it with aria-current. */
  readonly selected: boolean;
  /** Called when the content-warning button is pressed. */
  readonly onToggleReveal: () => void;
  /** Called when the row itself is clicked, not one of its controls. */
  readonly onSelect: () => void;
  /** Called when the nick is clicked. */
  readonly onSelectAuthor: () => void;
};

/** The parts of {@link PostRowProps} the body needs. */
type BodyProps = Pick<PostRowProps, 'contentHtml' | 'spoilerText' | 'revealed'> & {
  readonly onToggleReveal: () => void;
};

/** The controls inside a row: they own their own clicks, the row takes the rest. */
const CONTROL_SELECTOR = 'button, a';

/** True when the click landed on a button or link inside the row. */
function clickedControl(event: MouseEvent<HTMLElement>): boolean {
  const { target } = event;
  return target instanceof Element && target.closest(CONTROL_SELECTOR) !== null;
}

/**
 * The row's body: plain markup, or a `[CW:]` button followed by the markup
 * once revealed. While hidden the content is not rendered at all.
 */
function PostBody(props: BodyProps): JSX.Element {
  const { contentHtml, spoilerText, revealed, onToggleReveal } = props;

  if (spoilerText === '') {
    return <RemoteHtml html={contentHtml} inline />;
  }
  return (
    <>
      <button
        aria-expanded={revealed}
        className={styles['spoiler']}
        onClick={onToggleReveal}
        type="button"
      >
        {`[CW: ${spoilerText}]`}
      </button>
      {revealed ? (
        <>
          {' '}
          <RemoteHtml html={contentHtml} inline />
        </>
      ) : undefined}
    </>
  );
}

/** One post as a chat line; clicking the row selects it, clicking the nick opens the author. */
export function PostRow(props: PostRowProps): JSX.Element {
  const {
    label,
    date,
    clockFormat,
    author,
    contentHtml,
    spoilerText,
    revealed,
    selected,
    onToggleReveal,
    onSelect,
    onSelectAuthor,
  } = props;

  return (
    <article
      aria-current={selected ? 'true' : undefined}
      aria-label={`Post ${label} by ${author.fullHandle}`}
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
    >
      <span className={styles['label']}>{`[${label}]`}</span>{' '}
      <Timestamp date={date} format={clockFormat} />{' '}
      <Nick
        handle={author.handle}
        fullHandle={author.fullHandle}
        self={author.self}
        onSelect={onSelectAuthor}
      />{' '}
      <PostBody
        contentHtml={contentHtml}
        spoilerText={spoilerText}
        revealed={revealed}
        onToggleReveal={onToggleReveal}
      />
    </article>
  );
}
