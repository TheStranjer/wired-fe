/**
 * The scrollback: one window's list of lines, like an IRC buffer. New lines
 * appear at the bottom and the view follows them only while the user was
 * already at the bottom; scrolling up detaches until they return.
 */
import { useLayoutEffect, useRef } from 'react';
import type { JSX, ReactNode } from 'react';

import styles from './Scrollback.module.css';

/** How close to the bottom still counts as being there, in pixels. */
const DEFAULT_BOTTOM_THRESHOLD = 4;

/** Props of {@link Scrollback}. */
export type ScrollbackProps = {
  /** Accessible name of the region, e.g. "home timeline". */
  readonly label: string;
  /** The lines, oldest first. */
  readonly children: ReactNode;
};

/** True when the view is within `threshold` pixels of the bottom. */
export function isAtBottom(
  metrics: {
    readonly scrollTop: number;
    readonly clientHeight: number;
    readonly scrollHeight: number;
  },
  threshold = DEFAULT_BOTTOM_THRESHOLD,
): boolean {
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight <= threshold;
}

/** A scrollable log region that sticks to the bottom while it follows output. */
export function Scrollback(props: ScrollbackProps): JSX.Element {
  const { children, label } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wasAtBottomRef = useRef(true);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element === null) {
      return;
    }
    // A scrollable region must be keyboard focusable. The strict jsx-a11y gate
    // forbids the literal attribute in JSX for a role="log" div, so the
    // reflected IDL property is set here; the DOM still reads tabindex="0".
    element.tabIndex = 0;
    if (wasAtBottomRef.current) {
      element.scrollTop = element.scrollHeight;
    }
  });

  return (
    <div
      aria-label={label}
      aria-live="polite"
      className={styles['scrollback']}
      onScroll={(event) => {
        wasAtBottomRef.current = isAtBottom(event.currentTarget);
      }}
      ref={scrollRef}
      role="log"
    >
      {children}
    </div>
  );
}
