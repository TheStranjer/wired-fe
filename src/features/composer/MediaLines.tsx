/**
 * The attachment lines of a composer pane (WFE-205): under the textarea, the
 * `[ 📎 attach ]` button that opens the hidden file input and, below it, the
 * list of lines the command line's tray shares (src/views/AttachmentList).
 * Controlled and presentational: the pane owns the media
 * (./useComposerMedia).
 */
import { useRef } from 'react';
import type { ChangeEvent, JSX } from 'react';

import styles from './MediaLines.module.css';
import type { ComposerMedia } from '../../state/draft';
import { AttachmentList } from '../../views/AttachmentList';

/** What the lines show and the callbacks they drive. */
export type MediaLinesProps = {
  readonly items: readonly ComposerMedia[];
  /** Files the reader picked in the dialog. */
  readonly onFiles: (files: readonly File[]) => void;
  readonly onDescribe: (key: string, description: string) => void;
  readonly onRemove: (key: string) => void;
};

/** The attach button over its hidden multiple-file input. */
function AttachButton(props: Pick<MediaLinesProps, 'onFiles'>): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        aria-label="Attach media"
        className={styles['attach']}
        onClick={() => {
          inputRef.current?.click();
        }}
        type="button"
      >
        [ 📎 attach ]
      </button>
      <input
        accept="image/*,video/*,audio/*"
        aria-label="Media files"
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
  const { items, onFiles, onDescribe, onRemove } = props;
  return (
    <div className={styles['media']}>
      <AttachButton onFiles={onFiles} />
      {items.length === 0 ? null : (
        <AttachmentList
          items={items}
          label="Attachments"
          onDescribe={onDescribe}
          onRemove={onRemove}
        />
      )}
    </div>
  );
}
