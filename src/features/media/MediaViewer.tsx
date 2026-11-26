/**
 * The body of a media window once its post has loaded (WFE-263): attachment
 * `n` of the post at full size, fitted to the pane, with its description and
 * `n/N` under it and the step and open-original buttons beside them. A post
 * marked sensitive opens behind the same `[ SENSITIVE — show ]` cover the
 * card's media grid uses, until the reader opens it; stepping keeps it open.
 * An attachment the post no longer has (it was edited since) is said so.
 */
import { useState } from 'react';
import type { JSX } from 'react';

import { MediaSteps, OpenOriginal } from './MediaControls';
import { MediaFull } from './MediaFull';
import styles from './MediaViewer.module.css';
import type { Status } from '../../api/schemas/status';
import { useT } from '../../i18n/I18nProvider';
import { mediaStep } from '../../state/mediaWindow';
import { useAppDispatch } from '../../state/StateContext';
import { describedBy } from '../../ui/MediaTile';
import { mediaItem } from '../../views/mediaView';
import type { WindowState } from '../../windows/model';

/** Props of {@link MediaViewer}. */
type ViewerProps = {
  readonly win: WindowState;
  readonly status: Status;
  /** The 1-based attachment this window shows. */
  readonly n: number;
};

/** The solid block that stands in for hidden media. */
function Cover(props: { readonly onShow: () => void }): JSX.Element {
  const t = useT();
  return (
    <button className={styles['cover']} onClick={props.onShow} type="button">
      {t('features.media.sensitive_cover')}
    </button>
  );
}

/** The attachment {@link props.n} of {@link props.status}, with its controls. */
export function MediaViewer(props: ViewerProps): JSX.Element {
  const { win, status, n } = props;
  const dispatch = useAppDispatch();
  const t = useT();
  const [shown, setShown] = useState(!status.sensitive);
  const items = status.media_attachments.map(mediaItem);
  const item = items[n - 1];
  if (item === undefined) {
    return <p className={styles['notice']}>{t('features.media.no_attachment', { n })}</p>;
  }
  if (!shown) {
    return (
      <Cover
        onShow={() => {
          setShown(true);
        }}
      />
    );
  }
  return (
    <div className={styles['viewer']}>
      <div className={styles['stage']}>
        <MediaFull item={item} />
      </div>
      <p className={styles['description']}>
        {describedBy(item) ?? t('features.media.no_description')}
      </p>
      <div className={styles['bar']}>
        <MediaSteps
          n={n}
          onStep={(next) => {
            for (const action of mediaStep(win, status.id, { n: next, total: items.length })) {
              dispatch({ type: 'windows', action });
            }
          }}
          total={items.length}
        />
        <span className={styles['place']}>{`${String(n)}/${String(items.length)}`}</span>
        {item.url === null ? null : <OpenOriginal url={item.url} />}
      </div>
    </div>
  );
}
