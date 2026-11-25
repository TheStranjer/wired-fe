/**
 * A square account picture (decision 15), drawn as a bordered image of a fixed
 * size in line-heights so the layout never shifts while it loads. Purely
 * presentational. It shows the still image when animation is off or the user
 * prefers reduced motion; an image that fails to load, or an account with no
 * picture, shows the bundled default (decision 9) instead, once, never in a loop.
 */
import { useState } from 'react';
import type { JSX } from 'react';

import styles from './Avatar.module.css';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** The bundled default avatar every backend's missing-picture URL resolves to. */
const DEFAULT_AVATAR = 'images/avi.png';

/** Props of {@link Avatar}. */
export type AvatarProps = {
  /** The (possibly animated) image. */
  readonly src: string;
  /** The still image, shown when animation is off. */
  readonly staticSrc: string;
  /** The account's full handle, e.g. "@alice@m.example", for the alt text. */
  readonly handle: string;
  /** How big: two or three line-heights square. */
  readonly size: 'small' | 'medium';
  /** Whether the animated image may play; false always shows the still. */
  readonly animate: boolean;
};

/** An account picture, falling back to the default image once if it will not load. */
export function Avatar(props: AvatarProps): JSX.Element {
  const { src, staticSrc, handle, size, animate } = props;
  const reduced = usePrefersReducedMotion();
  const wanted = animate && !reduced ? src : staticSrc;
  const [failed, setFailed] = useState<string | null>(null);
  const shown = wanted === '' || failed === wanted ? DEFAULT_AVATAR : wanted;
  return (
    <img
      className={[styles['avatar'], styles[size]].join(' ')}
      src={shown}
      alt={`Avatar of ${handle}`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        setFailed(wanted);
      }}
    />
  );
}
