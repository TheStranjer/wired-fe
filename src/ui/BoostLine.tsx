/**
 * The dim line above a boosted post naming who boosted it:
 * `⟳ <bob> boosted`. Purely presentational, like the rest of the row;
 * `views/postView` decides when there is a booster to name. Boost metadata
 * is dimmed like the row's label.
 */
import type { JSX } from 'react';

import styles from './BoostLine.module.css';
import { Nick } from './Nick';

/** Props of {@link BoostLine}: who boosted the post below it. */
export type BoostLineProps = {
  /** The booster, in the nick's two handle forms. */
  readonly boostedBy: {
    readonly handle: string;
    readonly fullHandle: string;
  };
};

/** Who boosted the post, in their own dim line above it. */
export function BoostLine(props: BoostLineProps): JSX.Element {
  const { handle, fullHandle } = props.boostedBy;
  return (
    <div className={styles['boost']}>
      <span aria-hidden="true">{'⟳ '}</span>
      <Nick handle={handle} fullHandle={fullHandle} self={false} />
      {' boosted'}
    </div>
  );
}
