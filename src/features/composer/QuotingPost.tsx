/**
 * The post a quote composer quotes (WFE-262): one dim, non-interactive line
 * above the text, "Quoting @alice: …", beside {@link ReplyingTo}. The excerpt
 * is src/views/quoteView's, so remote markup is sanitised the same way and a
 * post behind a content warning shows the warning instead of its words.
 */

import type { JSX } from 'react';

import styles from './ReplyingTo.module.css';
import type { Status } from '../../api/schemas/status';
import { excerptOf } from '../../views/quoteView';

/** The dim "Quoting @author: excerpt" line of {@link status}. */
export function QuotingPost({ status }: { readonly status: Status }): JSX.Element {
  return (
    <p className={styles['replying']}>{`Quoting @${status.account.acct}: ${excerptOf(status)}`}</p>
  );
}
