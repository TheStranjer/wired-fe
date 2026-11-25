/**
 * The one place raw HTML renders (AGENTS.md Security, decision 10): status,
 * bio and display-name markup from arbitrary servers, sanitized by
 * {@link sanitizeRemoteHtml} before it reaches the DOM. ESLint allows
 * `dangerouslySetInnerHTML` only in this file; everywhere else it is a hard
 * error, so this component is the single HTML sink by construction. A post's
 * custom emoji are applied to the sanitized markup by {@link emojify}, so
 * the only images that ever render here are the ones that module builds from
 * the status's own emoji list.
 */
import { useMemo } from 'react';
import type { JSX } from 'react';

import { emojify, type EmojiRef } from './emojify';
import styles from './RemoteHtml.module.css';
import { sanitizeRemoteHtml } from './sanitize';

/** Props of {@link RemoteHtml}. */
export type RemoteHtmlProps = {
  /** Hostile remote HTML; sanitized before rendering, never as typed. */
  readonly html: string;
  /** Render an inline `span` root instead of the default block `div`. */
  readonly inline?: boolean;
  /** The post's own custom emoji; their `:shortcode:` text renders as images. */
  readonly emojis?: readonly EmojiRef[] | undefined;
  /** Drop the quote's "RE:/RT: link" fallback, because a quote card shows. */
  readonly dropQuoteFallback?: boolean;
};

/** Sanitized fediverse markup: the app's only raw-HTML rendering component. */
export function RemoteHtml(props: RemoteHtmlProps): JSX.Element {
  const { html, inline = false, emojis, dropQuoteFallback = false } = props;
  const safeHtml = useMemo(() => {
    const sanitized = sanitizeRemoteHtml(html, { dropQuoteFallback });
    return emojis === undefined || emojis.length === 0 ? sanitized : emojify(sanitized, emojis);
  }, [html, emojis, dropQuoteFallback]);

  const Root = inline ? 'span' : 'div';
  return <Root className={styles['root']} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}
