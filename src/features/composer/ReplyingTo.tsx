/**
 * The post a reply composer answers (WFE-244): one dim, non-interactive line
 * above the text, "Replying to @alice: …", in the manner of the quote under a
 * post (src/ui/QuoteBlock). The excerpt is src/views/quoteView's, so remote
 * markup is sanitised the same way and a post behind a content warning shows
 * the warning instead of its words.
 */

import type { JSX } from 'react';

import styles from './ReplyingTo.module.css';
import type { Status } from '../../api/schemas/status';
import { excerptOf } from '../../views/quoteView';

/** The dim "Replying to @author: excerpt" line of {@link status}. */
export function ReplyingTo({ status }: { readonly status: Status }): JSX.Element {
  return (
    <p className={styles['replying']}>
      {`Replying to @${status.account.acct}: ${excerptOf(status)}`}
    </p>
  );
}
