/**
 * The media of a post drawn inline in its card (decision 15): one image at the
 * card's full width, two to four in a two-column grid, and past four the first
 * four with a `+N` button over the last that shows the rest. A post marked
 * sensitive, or one whose body is still behind its content warning, hides the
 * whole grid behind a solid `[ SENSITIVE — show ]` block and renders nothing
 * from the remote server until it is opened. `autoExpand` — the `expandMedia`
 * setting — opens the cover of a post that is not sensitive. Which covers and
 * descriptions are open is this component's own state, like {@link MediaList}'s.
 * With `onOpenMedia`, a plain click on an image opens it in the media window
 * (WFE-264) rather than leaving for the raw file; only an image of an opened
 * grid can be clicked, so the cover's first click still just reveals, and the
 * `+N` button only shows the hidden tiles. Purely presentational: no media
 * autoplays or preloads.
 */
import { useState } from 'react';
import type { JSX } from 'react';

import type { OpenMedia } from './mediaClick';
import styles from './MediaGrid.module.css';
import type { MediaItem } from './MediaList';
import { MediaTile, describedBy } from './MediaTile';
import { useT } from '../i18n/I18nProvider';

/** How many tiles show before the rest hide behind `+N`. */
const VISIBLE = 4;

/** Props of {@link MediaGrid}. */
export type MediaGridProps = {
  readonly items: readonly MediaItem[];
  /** Whether the author marked the post sensitive. */
  readonly sensitive: boolean;
  /** Whether the post's body is still hidden behind its content warning. */
  readonly warned: boolean;
  /** The reader's `expandMedia` setting. */
  readonly autoExpand: boolean;
  /** Opens the attachment at a zero-based index in the media window; absent
   * leaves each image's link to the browser. */
  readonly onOpenMedia?: OpenMedia | undefined;
};

/** The descriptions of the open ALT badges, one line each, under the grid. */
function Descriptions(props: {
  readonly items: readonly MediaItem[];
  readonly open: ReadonlySet<string>;
}): JSX.Element | null {
  const t = useT();
  const lines = props.items.flatMap((item, index) => {
    const text = describedBy(item);
    return text === null || !props.open.has(item.id)
      ? []
      : [
          <p key={item.id} className={styles['description']}>
            {t('ui.media_grid.alt_line', { number: index + 1, text })}
          </p>,
        ];
  });
  return lines.length === 0 ? null : <div className={styles['descriptions']}>{lines}</div>;
}

/** The solid block that stands in for hidden media. */
function Cover(props: { readonly onShow: () => void }): JSX.Element {
  const t = useT();
  return (
    <button className={styles['cover']} onClick={props.onShow} type="button">
      {t('ui.media_grid.sensitive_show')}
    </button>
  );
}

/** The `+N` button over the last visible tile. */
function More(props: { readonly count: number; readonly onShow: () => void }): JSX.Element {
  const t = useT();
  return (
    <button
      aria-label={t('ui.media_grid.more', { count: props.count })}
      className={styles['more']}
      onClick={props.onShow}
      type="button"
    >
      {`+${String(props.count)}`}
    </button>
  );
}

/** Add {@link id} to the set if it is missing, remove it if it is there. */
function flip(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set);
  if (!next.delete(id)) {
    next.add(id);
  }
  return next;
}

/** The tiles of an opened grid, and the descriptions their ALT badges open. */
function Tiles(props: {
  readonly items: readonly MediaItem[];
  readonly onOpenMedia: OpenMedia | undefined;
}): JSX.Element {
  const { items, onOpenMedia } = props;
  const [all, setAll] = useState(false);
  const [alts, setAlts] = useState<ReadonlySet<string>>(() => new Set<string>());
  const hidden = all ? 0 : Math.max(items.length - VISIBLE, 0);
  const shown = items.slice(0, items.length - hidden);
  return (
    <div className={styles['media']}>
      <div className={shown.length === 1 ? styles['single'] : styles['pair']}>
        {shown.map((item, index) => (
          <MediaTile
            key={item.id}
            altOpen={alts.has(item.id)}
            index={index}
            item={item}
            onOpenMedia={onOpenMedia}
            onToggleAlt={() => {
              setAlts((current) => flip(current, item.id));
            }}
            overlay={
              hidden > 0 && index === shown.length - 1 ? (
                <More
                  count={hidden}
                  onShow={() => {
                    setAll(true);
                  }}
                />
              ) : null
            }
          />
        ))}
      </div>
      <Descriptions items={shown} open={alts} />
    </div>
  );
}

/** The media of one post: nothing without attachments, else the grid or its cover. */
export function MediaGrid(props: MediaGridProps): JSX.Element | null {
  const { items, sensitive, warned, autoExpand, onOpenMedia } = props;
  const [opened, setOpened] = useState(false);
  if (items.length === 0) {
    return null;
  }
  if ((sensitive || warned) && !opened && !(autoExpand && !sensitive)) {
    return (
      <Cover
        onShow={() => {
          setOpened(true);
        }}
      />
    );
  }
  return <Tiles items={items} onOpenMedia={onOpenMedia} />;
}
