/**
 * The body of one post row: the plain markup, or a `[CW:]` button followed by
 * the markup once revealed. Purely presentational (AGENTS.md "Layout"): which
 * warning the row carries comes from its props, and pressing the button is
 * {@link PostRow}'s `onToggleReveal` — holding the reveal in app state is the
 * state layer's job. While hidden the content is not rendered at all.
 */
import type { JSX } from 'react';

import type { EmojiRef } from './emojify';
import styles from './PostBody.module.css';
import { RemoteHtml } from './RemoteHtml';

/** Props of {@link PostBody}: the body and the one move the row offers it. */
export type PostBodyProps = {
  /** The body as hostile remote HTML; {@link RemoteHtml} sanitizes it. */
  readonly contentHtml: string;
  /** The post's own custom emoji, rendered inline in the body. */
  readonly emojis: readonly EmojiRef[];
  /** Whether a quote card shows, so the body's "RE:/RT: link" fallback goes. */
  readonly hasQuoteCard: boolean;
  /** The content warning text; the empty string means there is none. */
  readonly spoilerText: string;
  /** Whether a warned body is shown; meaningless without a warning. */
  readonly revealed: boolean;
  /** Called when the content-warning button is pressed. */
  readonly onToggleReveal: () => void;
};

/**
 * The row's body: plain markup, or a `[CW:]` button followed by the markup
 * once revealed. While hidden the content is not rendered at all.
 */
export function PostBody(props: PostBodyProps): JSX.Element {
  const { contentHtml, emojis, hasQuoteCard, spoilerText, revealed, onToggleReveal } = props;

  const body = (
    <RemoteHtml dropQuoteFallback={hasQuoteCard} emojis={emojis} html={contentHtml} inline />
  );
  if (spoilerText === '') {
    return body;
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
      {revealed ? <> {body}</> : undefined}
    </>
  );
}
