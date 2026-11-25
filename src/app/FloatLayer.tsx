/**
 * The floats of the active desktop (WFE-222, decision 12), drawn over the
 * split tree: an overlay that lets pointer events through except on the
 * floats themselves. Each float is a pane frame placed from its fractional
 * rectangle; array order is z-order. Its title bar drags it, a grip at the
 * bottom-right corner resizes it, and a pointer-down anywhere in it focuses
 * (and so raises) it.
 */
import { useCallback, useRef } from 'react';
import type { JSX, PointerEvent, PointerEventHandler } from 'react';

import { Pane, windowOf } from './DesktopPane';
import type { View } from './DesktopPane';
import styles from './FloatLayer.module.css';
import { useFloatGesture } from './useFloatGesture';
import type { Gesture } from './useFloatGesture';
import { useAppDispatch } from '../state/StateContext';
import type { FloatPane, Floats } from '../windows/floats';

/** Starts `gesture` on a float from a pointer-down. */
type Begin = (paneId: string, gesture: Gesture) => PointerEventHandler<HTMLElement>;

/** One float: its pane frame placed by rectangle, and its resize grip. */
function FloatBox(props: {
  readonly float: FloatPane;
  readonly view: View;
  readonly begin: Begin;
}): JSX.Element | null {
  const { float, view, begin } = props;
  const { x, y, w, h } = float.rect;
  const place = useCallback(
    (element: HTMLDivElement | null) => {
      element?.style.setProperty('--float-x', `${String(x * 100)}%`);
      element?.style.setProperty('--float-y', `${String(y * 100)}%`);
      element?.style.setProperty('--float-w', `${String(w * 100)}%`);
      element?.style.setProperty('--float-h', `${String(h * 100)}%`);
    },
    [x, y, w, h],
  );
  const win = windowOf(view, float.windowId);
  if (win === undefined) {
    return null;
  }
  const grab = (event: PointerEvent<HTMLElement>): void => {
    view.focus(float.paneId);
    begin(float.paneId, 'resize')(event);
  };
  return (
    <div ref={place} className={styles['float']}>
      <Pane
        paneId={float.paneId}
        win={win}
        view={view}
        titleBarProps={{ onPointerDown: begin(float.paneId, 'move') }}
      />
      <button
        type="button"
        aria-label="Resize window"
        className={styles['grip']}
        onPointerDown={grab}
      />
    </div>
  );
}

/** The overlay holding every float of the active desktop, bottom to top. */
export function FloatLayer(props: { readonly floats: Floats; readonly view: View }): JSX.Element {
  const layerRef = useRef<HTMLDivElement>(null);
  const begin = useFloatGesture(layerRef, useAppDispatch());
  return (
    <div ref={layerRef} className={styles['layer']}>
      {props.floats.map((float) => (
        <FloatBox key={float.paneId} float={float} view={props.view} begin={begin} />
      ))}
    </div>
  );
}
