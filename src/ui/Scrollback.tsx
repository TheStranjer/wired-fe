/**
 * The scrollback: one window's list of lines, like an IRC buffer. New lines
 * appear at the bottom and the view follows them only while the user was
 * already at the bottom; scrolling up detaches until they return. Scrolling on
 * up past the first line asks for older history through `onReachTop`, and when
 * older lines do arrive above the top the view keeps its place: it is pushed
 * down by exactly the height the new lines added.
 */
import { isValidElement, useLayoutEffect, useRef } from 'react';
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
  /** Ask for the lines above the top; called when the user scrolls to it. */
  readonly onReachTop?: (() => void) | undefined;
};

/** Where the view stood at the render the last layout effect measured. */
type Anchor = {
  /** The scrollHeight of that render. */
  readonly height: number;
  /** The key of its first line, null when that line had none. */
  readonly firstKey: string | null;
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

/**
 * The scroll position that keeps the same lines on screen when the content
 * changed height: the old position moved by that difference, never above the
 * top. Lines prepended above the top grow the height and push the view down.
 */
export function adjustedScrollTop(
  previousHeight: number,
  newHeight: number,
  scrollTop: number,
): number {
  return Math.max(0, scrollTop + (newHeight - previousHeight));
}

/** Whether {@link children} is a line list, the way `lines.map(...)` hands it over. */
function isNodeList(children: ReactNode): children is readonly ReactNode[] {
  return Array.isArray(children);
}

/** The key of the first line; null when the scrollback is empty or its lines are unkeyed. */
function firstChildKey(children: ReactNode): string | null {
  const first = isNodeList(children) ? children[0] : children;
  return isValidElement(first) ? first.key : null;
}

/** A scrollable log region that sticks to the bottom while it follows output. */
export function Scrollback(props: ScrollbackProps): JSX.Element {
  const { children, label, onReachTop } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wasAtBottomRef = useRef(true);
  const anchorRef = useRef<Anchor>({ height: 0, firstKey: null });

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element === null) {
      return;
    }
    // A scrollable region must be keyboard focusable. The strict jsx-a11y gate
    // forbids the literal attribute in JSX for a role="log" div, so the
    // reflected IDL property is set here; the DOM still reads tabindex="0".
    element.tabIndex = 0;
    const { height, firstKey: previousKey } = anchorRef.current;
    const { scrollHeight, scrollTop } = element;
    const firstKey = firstChildKey(children);
    anchorRef.current = { height: scrollHeight, firstKey };
    if (wasAtBottomRef.current) {
      element.scrollTop = scrollHeight;
    } else if (firstKey !== previousKey) {
      element.scrollTop = adjustedScrollTop(height, scrollHeight, scrollTop);
    }
  });

  return (
    <div
      aria-label={label}
      aria-live="polite"
      className={styles['scrollback']}
      onScroll={(event) => {
        const element = event.currentTarget;
        wasAtBottomRef.current = isAtBottom(element);
        if (element.scrollTop === 0) {
          onReachTop?.();
        }
      }}
      ref={scrollRef}
      role="log"
    >
      {children}
    </div>
  );
}
