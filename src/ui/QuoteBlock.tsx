/**
 * The quote under its quoter (WFE-99): one dim, indented `┌ [a4] <bob>
 * present day, present time` line below the post that quotes. Purely
 * presentational (AGENTS.md "Layout"): views/postView maps the quoted status
 * onto these props, and the nick is the same plain {@link Nick} the scrollback
 * uses everywhere — clicking quotes is a later ticket's move.
 */
import type { JSX } from 'react';

import { Nick } from './Nick';
import styles from './QuoteBlock.module.css';

/** Props of {@link QuoteBlock}: the quoted post one excerpt line shows. */
export type QuoteBlockProps = {
  /** The short label the window gave the quoted post, e.g. "a4"; null when it
   * has none, and the bracketed tag is left out. */
  readonly label: string | null;
  /** Who wrote the quoted post, shown by {@link Nick}. */
  readonly author: {
    readonly handle: string;
    readonly fullHandle: string;
  };
  /** The quoted content as one plain-text line, or its `[CW: …]` notice. */
  readonly excerpt: string;
};

/** One quoted post: the tree glyph, its label, its nick and its excerpt. */
export function QuoteBlock(props: QuoteBlockProps): JSX.Element {
  const { label, author, excerpt } = props;

  return (
    <div className={styles['quote']}>
      <span aria-hidden="true">{'     ┌ '}</span>
      {label === null ? undefined : `[${label}] `}
      <Nick handle={author.handle} fullHandle={author.fullHandle} self={false} />
      {` ${excerpt}`}
    </div>
  );
}
