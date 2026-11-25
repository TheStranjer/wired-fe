/**
 * Who boosted a post, as the line above a card's author: the booster's small
 * picture when avatars show, then the {@link BoostLine} words. Purely
 * presentational.
 */
import type { JSX } from 'react';

import { Avatar } from './Avatar';
import { BoostLine } from './BoostLine';
import styles from './CardBoost.module.css';
import type { PostRowProps } from './PostRow';

/** Props of {@link CardBoost}. */
export type CardBoostProps = {
  /** Who boosted the post, with their picture; null when nothing boosted it. */
  readonly boostedBy:
    | (NonNullable<PostRowProps['boostedBy']> & {
        readonly avatar: { readonly src: string; readonly staticSrc: string };
      })
    | null;
  /** Whether avatars show. */
  readonly showAvatar: boolean;
};

/** Who boosted the post, with their small picture when avatars show. */
export function CardBoost(props: CardBoostProps): JSX.Element | null {
  const { boostedBy, showAvatar } = props;
  if (boostedBy === null) {
    return null;
  }
  return (
    <div className={styles['boost']}>
      {showAvatar ? (
        <Avatar
          animate={false}
          handle={boostedBy.fullHandle}
          size="small"
          src={boostedBy.avatar.src}
          staticSrc={boostedBy.avatar.staticSrc}
        />
      ) : undefined}
      <BoostLine boostedBy={boostedBy} />
    </div>
  );
}
