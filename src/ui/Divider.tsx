/**
 * The draggable divider between the two halves of a split (WFE-221): a 1px
 * line with a wider invisible hit area. Drag it with a pointer, or focus it
 * and use the arrow keys (±5%), `Home` and `End`; double-click resets it to
 * an even split. It reports the ratio it wants through `onRatioChange` and
 * owns no layout state. It is a focusable `separator`, a widget in WAI-ARIA,
 * so its role, focus and handlers are spread from {@link useDivider}.
 */
import { useRef } from 'react';
import type { HTMLAttributes, JSX, KeyboardEvent, PointerEvent, RefObject } from 'react';

import styles from './Divider.module.css';
import { useT } from '../i18n/I18nProvider';
import { DEFAULT_RATIO, keyedRatio, ownsDividerKey, ratioFromPointer } from '../lib/dividerRatio';
import type { RatioBounds } from '../lib/dividerRatio';

/** What a divider needs from the split it sits in. */
export type DividerProps = {
  /** `vertical` for a line between side-by-side panes, `horizontal` between stacked ones. */
  readonly orientation: 'vertical' | 'horizontal';
  /** The split's current ratio, 0 to 1. */
  readonly ratio: number;
  /** The smallest and largest ratio the split takes. */
  readonly bounds: RatioBounds;
  /** The split's container: pointer positions are measured against it. */
  readonly containerRef: RefObject<HTMLElement | null>;
  /** Called with each new ratio the user asks for. */
  readonly onRatioChange: (ratio: number) => void;
};

/** Pointer position along the split's axis, and the container's extent there. */
function measure(
  event: PointerEvent<HTMLElement>,
  container: HTMLElement,
  orientation: DividerProps['orientation'],
): { at: number; start: number; size: number } {
  const rect = container.getBoundingClientRect();
  return orientation === 'vertical'
    ? { at: event.clientX, start: rect.left, size: rect.width }
    : { at: event.clientY, start: rect.top, size: rect.height };
}

/** The role, aria values, focus stop and handlers of a divider. */
function useDivider(props: DividerProps): HTMLAttributes<HTMLDivElement> {
  const { orientation, ratio, bounds, containerRef, onRatioChange } = props;
  const draggingRef = useRef(false);
  const t = useT();
  return {
    role: 'separator',
    tabIndex: 0,
    'aria-label': t('ui.divider.resize'),
    'aria-orientation': orientation,
    'aria-valuenow': Math.round(ratio * 100),
    'aria-valuemin': Math.round(bounds.min * 100),
    'aria-valuemax': Math.round(bounds.max * 100),
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      draggingRef.current = true;
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const container = containerRef.current;
      if (!draggingRef.current || container === null) {
        return;
      }
      const { at, ...span } = measure(event, container, orientation);
      onRatioChange(ratioFromPointer(at, span, bounds));
    },
    // The browser releases the pointer capture itself on up and cancel.
    onPointerUp: () => {
      draggingRef.current = false;
    },
    onPointerCancel: () => {
      draggingRef.current = false;
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (ownsDividerKey(event)) {
        event.preventDefault();
        onRatioChange(keyedRatio(event.key, ratio, bounds));
      }
    },
    onDoubleClick: () => {
      onRatioChange(DEFAULT_RATIO);
    },
  };
}

/** A line between two panes that resizes them. */
export function Divider(props: DividerProps): JSX.Element {
  const attributes = useDivider(props);
  const className = props.orientation === 'vertical' ? styles['vertical'] : styles['horizontal'];
  return <div {...attributes} className={className} />;
}
