/**
 * The post a quote composer quotes (WFE-262): one dim, non-interactive line
 * above the text, "Quoting @alice: …", beside {@link ReplyingTo}. The excerpt
 * is src/views/quoteView's, so remote markup is sanitised the same way and a
 * post behind a content warning shows the warning instead of its words.
 */

import type { JSX } from 'react';

import styles from './ReplyingTo.module.css';
import type { Status } from '../../api/schemas/status';
import { useT } from '../../i18n/I18nProvider';
import { excerptOf } from '../../views/quoteView';

/** The dim "Quoting @author: excerpt" line of {@link status}. */
export function QuotingPost({ status }: { readonly status: Status }): JSX.Element {
  const t = useT();
  return (
    <p className={styles['replying']}>
      {t('features.composer.quoting', { author: status.account.acct, excerpt: excerptOf(status) })}
    </p>
  );
}
