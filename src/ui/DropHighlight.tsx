/**
 * The full-window drop highlight (WFE-127): a dashed frame across the whole
 * viewport with `-- drop to attach --` in its centre, shown while a file is
 * being dragged over the app. Presentational only and takes no props:
 * deciding when it is up belongs to the drag-tracking layer that mounts it.
 * It is decorative over the live UI, so it is aria-hidden and ignores the
 * pointer, letting the window underneath keep receiving the drag events.
 */
import type { JSX } from 'react';

import styles from './DropHighlight.module.css';

/** The full-viewport `-- drop to attach --` frame shown during a file drag. */
export function DropHighlight(): JSX.Element {
  return (
    <div aria-hidden="true" className={styles['overlay']}>
      -- drop to attach --
    </div>
  );
}
