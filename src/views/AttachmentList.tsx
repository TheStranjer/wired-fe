/**
 * The list of attachment lines both the composer pane (WFE-205) and the command
 * line's tray (WFE-287) show: one line per file — a thumbnail for a picture the
 * instance accepted, the file's name, an alt-text input labelled "Description
 * for <file>", the upload state (or the reason it failed) and `[x]` to take it
 * off the draft. Controlled and presentational: whoever owns the media
 * (src/state/composerMedia) passes the lines and the callbacks.
 */
import type { ChangeEvent, JSX } from 'react';

import styles from './AttachmentList.module.css';
import type { ComposerMedia } from '../state/draft';

/** What the list shows and the callbacks it drives. */
export type AttachmentListProps = {
  readonly items: readonly ComposerMedia[];
  /** The accessible name of the list, e.g. `Attachments`. */
  readonly label: string;
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
function AttachmentLine(
  props: Pick<AttachmentListProps, 'onDescribe' | 'onRemove'> & {
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

/** The labelled list of attachment lines. */
export function AttachmentList(props: AttachmentListProps): JSX.Element {
  const { items, label, onDescribe, onRemove } = props;
  return (
    <ul aria-label={label} className={styles['list']}>
      {items.map((item) => (
        <AttachmentLine item={item} key={item.key} onDescribe={onDescribe} onRemove={onRemove} />
      ))}
    </ul>
  );
}
