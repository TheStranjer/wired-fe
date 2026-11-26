/**
 * The post an edit composer rewrites (WFE-268): one dim, non-interactive line
 * above the text, "editing [a4]: …", beside {@link ReplyingTo}. The label is the
 * one the windows gave the post, and the excerpt is src/views/quoteView's of
 * the post as it was, so remote markup is sanitised the same way and a post
 * behind a content warning shows the warning instead of its words.
 */

import type { JSX } from 'react';

import styles from './ReplyingTo.module.css';
import type { Status } from '../../api/schemas/status';
import { useT } from '../../i18n/I18nProvider';
import { postLabel } from '../../state/editPost';
import { useAppState } from '../../state/StateContext';
import { excerptOf } from '../../views/quoteView';

/** The dim "editing [label]: excerpt" line of {@link status}. */
export function EditingPost({ status }: { readonly status: Status }): JSX.Element {
  const state = useAppState();
  const t = useT();
  return (
    <p className={styles['replying']}>
      {t('features.composer.editing', {
        label: postLabel(state, status),
        excerpt: excerptOf(status),
      })}
    </p>
  );
}
