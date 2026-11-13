/**
 * The one place raw HTML renders (AGENTS.md Security, decision 10): status,
 * bio and display-name markup from arbitrary servers, sanitized by
 * {@link sanitizeRemoteHtml} before it reaches the DOM. ESLint allows
 * `dangerouslySetInnerHTML` only in this file; everywhere else it is a hard
 * error, so this component is the single HTML sink by construction.
 */
import { useMemo } from 'react';
import type { JSX } from 'react';

import styles from './RemoteHtml.module.css';
import { sanitizeRemoteHtml } from './sanitize';

/** Props of {@link RemoteHtml}. */
export type RemoteHtmlProps = {
  /** Hostile remote HTML; sanitized before rendering, never as typed. */
  readonly html: string;
  /** Render an inline `span` root instead of the default block `div`. */
  readonly inline?: boolean;
};

/** Sanitized fediverse markup: the app's only raw-HTML rendering component. */
export function RemoteHtml(props: RemoteHtmlProps): JSX.Element {
  const { html, inline = false } = props;
  const safeHtml = useMemo(() => sanitizeRemoteHtml(html), [html]);

  if (inline) {
    return <span className={styles['root']} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
  }
  return <div className={styles['root']} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}
