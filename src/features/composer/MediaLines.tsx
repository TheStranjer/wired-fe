/**
 * The attachment lines of a composer pane (WFE-205): under the textarea, one
 * line per file — a thumbnail for a picture the instance accepted, the file's
 * name, an alt-text input labelled "Description for <file>", the upload state
 * (or the reason it failed) and `[x]` to take it off the draft — and the
 * `[ 📎 attach ]` button that opens the hidden file input. Controlled and
 * presentational: the pane owns the media (./useComposerMedia).
 */
import { useRef } from 'react';
import type { ChangeEvent, JSX } from 'react';

import styles from './MediaLines.module.css';
import type { ComposerMedia } from '../../state/draft';

/** What the lines show and the callbacks they drive. */
export type MediaLinesProps = {
  readonly items: readonly ComposerMedia[];
  /** Files the reader picked in the dialog. */
  readonly onFiles: (files: readonly File[]) => void;
  readonly onDescribe: (key: string, description: string) => void;
  readonly onRemove: (key: string) => void;
};

/** What a line says of its upload. */
function stateText(item: ComposerMedia): string {
  switch (item.status) {
    case 'uploading':
      return 'uploading…';
    case 'ready':
      return 'ready';
    case 'failed':
      return `failed: ${item.error}`;
  }
}

/** One attachment: thumbnail, name, alt text, state and remove. */
function MediaLine(
  props: Omit<MediaLinesProps, 'items' | 'onFiles'> & {
    readonly item: ComposerMedia;
  },
): JSX.Element {
  const { item, onDescribe, onRemove } = props;
  return (
    <li className={styles['line']}>
      {item.previewUrl === null ? (
        <span aria-hidden="true" className={styles['thumb']} />
      ) : (
        <img
          alt=""
          className={styles['thumb']}
          decoding="async"
          loading="lazy"
          referrerPolicy="no-referrer"
          src={item.previewUrl}
        />
      )}
      <span className={styles['name']}>{item.name}</span>
      <input
        aria-label={`Description for ${item.name}`}
        className={styles['description']}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onDescribe(item.key, event.target.value);
        }}
        type="text"
        value={item.description}
      />
      <span aria-live="polite" className={item.status === 'failed' ? styles['failed'] : undefined}>
        {stateText(item)}
      </span>
      <button
        aria-label={`Remove ${item.name}`}
        className={styles['remove']}
        onClick={() => {
          onRemove(item.key);
        }}
        type="button"
      >
        [x]
      </button>
    </li>
  );
}

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
        <ul aria-label="Attachments" className={styles['list']}>
          {items.map((item) => (
            <MediaLine item={item} key={item.key} onDescribe={onDescribe} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </div>
  );
}
