/**
 * The attachment lines of a pane with a box to write in (WFE-205, WFE-289):
 * under the textarea, the `[ 📎 attach ]` button that opens the hidden file
 * input — `[📎]` in a docked box, where room is short — and, below it, the
 * list of lines the command line's tray shares (./AttachmentList). Controlled
 * and presentational: the pane owns the media (./useComposerMedia).
 */
import { useRef } from 'react';
import type { ChangeEvent, JSX } from 'react';

import { AttachmentList } from './AttachmentList';
import styles from './MediaLines.module.css';
import { useT } from '../i18n/I18nProvider';
import type { ComposerMedia } from '../state/draft';

/** What the lines show and the callbacks they drive. */
export type MediaLinesProps = {
  readonly items: readonly ComposerMedia[];
  /** Files the reader picked in the dialog. */
  readonly onFiles: (files: readonly File[]) => void;
  readonly onDescribe: (key: string, description: string) => void;
  readonly onRemove: (key: string) => void;
  /** The short `[📎]` button of a docked box, and the lines scroll inside a box of their own. */
  readonly compact?: boolean;
};

/** The attach button over its hidden multiple-file input. */
function AttachButton(
  props: Pick<MediaLinesProps, 'onFiles'> & { readonly compact: boolean },
): JSX.Element {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        aria-label={t('views.media.attach')}
        className={styles['attach']}
        onClick={() => {
          inputRef.current?.click();
        }}
        type="button"
      >
        {props.compact ? t('views.media.attach_short') : t('views.media.attach_button')}
      </button>
      <input
        accept="image/*,video/*,audio/*"
        aria-label={t('views.media.files')}
        hidden
        multiple
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const input = event.currentTarget;
          props.onFiles([...(input.files ?? [])]);
          input.value = '';
        }}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />
    </>
  );
}

/** The attach button and the list of attachments below the textarea. */
export function MediaLines(props: MediaLinesProps): JSX.Element {
  const t = useT();
  const { items, onFiles, onDescribe, onRemove } = props;
  const compact = props.compact === true;
  const list =
    items.length === 0 ? null : (
      <AttachmentList
        items={items}
        label={t('views.media.attachments')}
        onDescribe={onDescribe}
        onRemove={onRemove}
      />
    );
  return (
    <div className={compact ? styles['mediaCompact'] : styles['media']}>
      <AttachButton compact={compact} onFiles={onFiles} />
      {compact && list !== null ? <div className={styles['rowsCompact']}>{list}</div> : list}
    </div>
  );
}
