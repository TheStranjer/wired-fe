/**
 * The media attachments of a post as expandable placeholder lines, IRC style:
 * one line per file, `[IMG 1/2: a description]`, which opens the file under the
 * placeholder when clicked (WFE-97). `autoExpand` — the reader's `expandMedia`
 * setting — starts every line open, but a post its author marked sensitive never
 * does: its lines say `[SENSITIVE]` and stay shut until opened by hand. Which
 * lines are open is this component's own state, like a buffer's scroll position:
 * the CW reveal is app state because commands drive it, placeholders are not.
 * Purely presentational (AGENTS.md "Layout"): api's MediaAttachment reaches it
 * through views/postView as plain data, never as an API type, and no media here
 * preloads, autoplays, or opens a window back to the remote file.
 */
import { useState } from 'react';
import type { JSX } from 'react';

import styles from './MediaList.module.css';

/** One attachment as the list draws it: the ui twin of api's MediaAttachment,
 * which this layer may not import (AGENTS.md "Layout"). */
export type MediaItem = {
  readonly id: string;
  readonly type: 'image' | 'gifv' | 'video' | 'audio' | 'unknown';
  readonly url: string;
  readonly previewUrl: string | null;
  readonly description: string | null;
};

/** The word each kind earns inside its placeholder. */
const KIND_LABEL: Record<MediaItem['type'], string> = {
  image: 'IMG',
  gifv: 'GIF',
  video: 'VID',
  audio: 'AUD',
  unknown: 'FILE',
};

/** The placeholder of one attachment: `[IMG 1/2: a wall]`. */
function placeholder(item: MediaItem, index: number, total: number): string {
  const description = item.description ?? 'no description';
  return `[${KIND_LABEL[item.type]} ${String(index + 1)}/${String(total)}: ${description}]`;
}

/** What an opened line shows: the file itself where the browser can play or
 * draw it, a plain link where it cannot. Captions are the markup contract the
 * accessibility gate asks of every media element, not a promise of a track. */
function ExpandedMedia(props: { readonly item: MediaItem }): JSX.Element {
  const { item } = props;
  switch (item.type) {
    case 'image':
    case 'gifv':
      return (
        <a className={styles['link']} href={item.url} rel="noopener noreferrer" target="_blank">
          <img
            alt={item.description ?? ''}
            className={styles['image']}
            src={item.previewUrl ?? item.url}
          />
        </a>
      );
    case 'video':
      return (
        <video className={styles['player']} controls preload="none" src={item.url}>
          <track kind="captions" />
        </video>
      );
    case 'audio':
      return (
        <audio className={styles['player']} controls preload="none" src={item.url}>
          <track kind="captions" />
        </audio>
      );
    case 'unknown':
      return (
        <a className={styles['link']} href={item.url} rel="noopener noreferrer" target="_blank">
          {item.url}
        </a>
      );
  }
}

/** Props of {@link MediaLine}: one attachment, its placeholder, and its state. */
type MediaLineProps = {
  readonly item: MediaItem;
  readonly text: string;
  readonly sensitive: boolean;
  readonly expanded: boolean;
  readonly onToggle: () => void;
};

/** One placeholder line: the `[IMG …]` button and, once open, the file. */
function MediaLine(props: MediaLineProps): JSX.Element {
  const { item, text, sensitive, expanded, onToggle } = props;
  return (
    <div className={styles['line']}>
      <button
        aria-expanded={expanded}
        className={styles['toggle']}
        onClick={onToggle}
        type="button"
      >
        {sensitive ? <span className={styles['sensitive']}>[SENSITIVE]</span> : undefined}
        {sensitive ? ` ${text}` : text}
      </button>
      {expanded ? <ExpandedMedia item={item} /> : undefined}
    </div>
  );
}

/**
 * The media of one post, below its body: nothing at all when the post carries
 * no attachment, one placeholder line per attachment otherwise.
 */
export function MediaList(props: {
  readonly items: readonly MediaItem[];
  readonly sensitive: boolean;
  readonly autoExpand: boolean;
}): JSX.Element | null {
  const { items, sensitive, autoExpand } = props;
  const [open, setOpen] = useState<ReadonlySet<string>>(() =>
    autoExpand && !sensitive ? new Set(items.map((item) => item.id)) : new Set<string>(),
  );

  if (items.length === 0) {
    return null;
  }

  /** Open {@link id} if it was closed, close it if it was open. */
  function toggle(id: string): void {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <>
      {items.map((item, index) => (
        <MediaLine
          key={item.id}
          expanded={open.has(item.id)}
          item={item}
          onToggle={() => {
            toggle(item.id);
          }}
          sensitive={sensitive}
          text={placeholder(item, index, items.length)}
        />
      ))}
    </>
  );
}
