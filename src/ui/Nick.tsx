/**
 * An IRC-style author nick: `<handle>` in the scrollback. Purely
 * presentational: clicking it opens the account behind the nick, but what
 * that means is up to the caller, which passes onSelect.
 */
import type { JSX } from 'react';

import { onMiddleClick } from './middleClick';
import styles from './Nick.module.css';
import type { ClickModifiers } from '../lib/clickModifiers';

/** Props of {@link Nick}. */
export type NickProps = {
  /** What is shown, e.g. "alice" or "alice@m.example". */
  readonly handle: string;
  /** The full handle, e.g. "@alice@m.example", for the title and accessible name. */
  readonly fullHandle: string;
  /** True when this nick is the current user's own. */
  readonly self: boolean;
  /** Called with the click when the nick is clicked, by the primary or the
   * middle button; omit to render plain, unclickable text. */
  readonly onSelect?: (click: ClickModifiers) => void;
  /** True in a one-line, flex-row slot (the nick list): the handle then shrinks
   * and ends in an ellipsis when it is too long, and the brackets never shrink. */
  readonly truncate?: boolean;
};

/**
 * The handle's classes: the plain-text button look and the self highlight come
 * after .handle in the stylesheet, so on equal specificity they win.
 */
function handleClasses(self: boolean, clickable: boolean, truncate: boolean): string {
  return [
    styles['handle'],
    truncate ? styles['truncate'] : undefined,
    clickable ? styles['button'] : undefined,
    self ? styles['self'] : undefined,
  ].join(' ');
}

/** The handle as `<handle>`, as a button when onSelect is given, else a span. */
export function Nick(props: NickProps): JSX.Element {
  const { handle, fullHandle, self, onSelect, truncate = false } = props;
  const classes = handleClasses(self, onSelect !== undefined, truncate);

  return (
    <>
      <span aria-hidden="true" className={styles['bracket']}>
        &lt;
      </span>
      {onSelect === undefined ? (
        <span className={classes} title={fullHandle}>
          {handle}
        </span>
      ) : (
        <button
          aria-label={fullHandle}
          className={classes}
          onAuxClick={onMiddleClick(onSelect)}
          onClick={onSelect}
          title={fullHandle}
          type="button"
        >
          {handle}
        </button>
      )}
      <span aria-hidden="true" className={styles['bracket']}>
        &gt;
      </span>
    </>
  );
}
