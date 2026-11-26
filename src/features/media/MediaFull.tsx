/**
 * One attachment at full size inside a media window (WFE-263): an image or
 * gifv drawn from its `url`, not its preview, referrer-free; a video that
 * never autoplays and loops a gifv only when the reader has not asked for
 * reduced motion; an audio player; or a link line for any other file. The
 * `<img alt>` text is the description, as MediaTile does. Fitting the media
 * to the pane is the stylesheet's: contained, centred, never upscaled.
 */
import type { JSX } from 'react';

import styles from './MediaViewer.module.css';
import { useT } from '../../i18n/I18nProvider';
import type { MediaItem } from '../../ui/MediaList';
import { describedBy } from '../../ui/MediaTile';
import { usePrefersReducedMotion } from '../../ui/usePrefersReducedMotion';

/** What shows where an attachment has no http(s) address to load. */
function Unavailable(): JSX.Element {
  const t = useT();
  return <span className={styles['unavailable']}>{t('features.media.no_link')}</span>;
}

/** A video or gifv: it waits for the play button, and a gifv loops muted once played. */
function Video(props: { readonly item: MediaItem; readonly url: string }): JSX.Element {
  const { item, url } = props;
  const reduced = usePrefersReducedMotion();
  const gifv = item.type === 'gifv';
  return (
    <video
      className={styles['media']}
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

/** The file at {@link props.item}'s `url`, drawn the way its kind is shown. */
export function MediaFull(props: { readonly item: MediaItem }): JSX.Element {
  const { item } = props;
  const { url } = item;
  const t = useT();
  if (url === null) {
    return <Unavailable />;
  }
  switch (item.type) {
    case 'image':
      return (
        <img
          alt={describedBy(item) ?? t('features.media.no_description')}
          className={styles['media']}
          referrerPolicy="no-referrer"
          src={url}
        />
      );
    case 'gifv':
    case 'video':
      return <Video item={item} url={url} />;
    case 'audio':
      return (
        <audio className={styles['player']} controls preload="none" src={url}>
          <track kind="captions" />
        </audio>
      );
    case 'unknown':
      return (
        <a className={styles['link']} href={url} rel="noopener noreferrer" target="_blank">
          {url}
        </a>
      );
  }
}
