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
import { useT } from '../../i18n/I18nProvider';
import { excerptOf } from '../../views/quoteView';

/** The dim "Replying to @author: excerpt" line of {@link status}. */
export function ReplyingTo({ status }: { readonly status: Status }): JSX.Element {
  const t = useT();
  return (
    <p className={styles['replying']}>
      {t('features.composer.replying', { author: status.account.acct, excerpt: excerptOf(status) })}
    </p>
  );
}
