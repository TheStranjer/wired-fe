/**
 * One attachment inside the media grid (decision 15): an image drawn from its
 * preview and linking to the full file, a video or gifv that never autoplays,
 * an audio player, or a plain link for any other file, plus the small ALT badge
 * that toggles the image description. With `onOpenMedia` a plain click on the
 * image or file link opens the attachment in the media window (WFE-264) and
 * the link keeps its `href`, so a middle or modified click still reaches the
 * raw file; without it the link is left to the browser. Players keep their own
 * controls. Purely presentational; the grid owns which descriptions are open.
 */
import type { JSX } from 'react';

import { mediaClick, type OpenMedia } from './mediaClick';
import styles from './MediaGrid.module.css';
import type { MediaItem } from './MediaList';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { useT } from '../i18n/I18nProvider';

/** The attachment's description, or null when it has none worth showing. */
export function describedBy(item: MediaItem): string | null {
  return item.description === null || item.description === '' ? null : item.description;
}

/** What shows where an attachment has no http(s) address to load. */
function Unavailable(): JSX.Element {
  const t = useT();
  return <span className={styles['unavailable']}>{t('ui.media_tile.no_usable_link')}</span>;
}

/** What a file needs besides the attachment: its place and how a click opens it. */
type FileProps = {
  readonly item: MediaItem;
  readonly index: number;
  readonly onOpenMedia: OpenMedia | undefined;
};

/** An image: the preview, lazy and referrer-free, linking to the full file. */
function ImageFile(props: FileProps): JSX.Element {
  const { item, index, onOpenMedia } = props;
  const t = useT();
  const src = item.previewUrl ?? item.url;
  if (src === null) {
    return <Unavailable />;
  }
  const image = (
    <img
      alt={describedBy(item) ?? t('ui.media_tile.no_description')}
      className={styles['image']}
      loading="lazy"
      referrerPolicy="no-referrer"
      src={src}
    />
  );
  return item.url === null ? (
    image
  ) : (
    <a
      className={styles['link']}
      href={item.url}
      onClick={mediaClick(onOpenMedia, index)}
      rel="noopener noreferrer"
      target="_blank"
    >
      {image}
    </a>
  );
}

/** A video or gifv: it waits for the play button, and a gifv loops muted once
 * played unless the reader asked for reduced motion. Never autoplays. */
function VideoFile(props: { readonly item: MediaItem; readonly url: string }): JSX.Element {
  const { item, url } = props;
  const reduced = usePrefersReducedMotion();
  const gifv = item.type === 'gifv';
  return (
    <video
      className={styles['player']}
      controls
      loop={gifv && !reduced}
      muted={gifv}
      poster={item.previewUrl ?? undefined}
      preload="none"
      src={url}
    >
      <track kind="captions" />
    </video>
  );
}

/** The file itself where the browser can show it, a link line where not. */
function MediaFile(props: FileProps): JSX.Element {
  const { item, index, onOpenMedia } = props;
  const { url } = item;
  if (item.type === 'image') {
    return <ImageFile index={index} item={item} onOpenMedia={onOpenMedia} />;
  }
  if (url === null) {
    return <Unavailable />;
  }
  switch (item.type) {
    case 'gifv':
    case 'video':
      return <VideoFile item={item} url={url} />;
    case 'audio':
      return (
        <audio className={styles['player']} controls preload="none" src={url}>
          <track kind="captions" />
        </audio>
      );
    case 'unknown':
      return (
        <a
          className={styles['link']}
          href={url}
          onClick={mediaClick(onOpenMedia, index)}
          rel="noopener noreferrer"
          target="_blank"
        >
          {url}
        </a>
      );
  }
}

/** Props of {@link MediaTile}. */
export type MediaTileProps = {
  readonly item: MediaItem;
  /** Zero-based place among the post's attachments, for the badge's name. */
  readonly index: number;
  /** Whether this tile's description is open under the grid. */
  readonly altOpen: boolean;
  readonly onToggleAlt: () => void;
  /** Something laid over the tile, such as the `+N` button; null for none. */
  readonly overlay: JSX.Element | null;
  /** Opens this attachment in the media window; absent leaves links native. */
  readonly onOpenMedia?: OpenMedia | undefined;
};

/** One attachment with its ALT badge, when it has a description. */
export function MediaTile(props: MediaTileProps): JSX.Element {
  const { item, index, altOpen, onToggleAlt, overlay, onOpenMedia } = props;
  const t = useT();
  return (
    <div className={styles['tile']}>
      <MediaFile index={index} item={item} onOpenMedia={onOpenMedia} />
      {describedBy(item) === null ? undefined : (
        <button
          aria-expanded={altOpen}
          aria-label={t('ui.media_tile.alt_label', { number: index + 1 })}
          className={styles['alt']}
          onClick={onToggleAlt}
          type="button"
        >
          {t('ui.media_tile.alt')}
        </button>
      )}
      {overlay}
    </div>
  );
}
