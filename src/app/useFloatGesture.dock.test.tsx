/**
 * Tests for docking in the float gesture hook (WFE-231): while a float is moved
 * with Shift held the tree pane under the pointer is reported as the dock
 * target, and a release over it docks; without Shift, on a resize, or outside
 * every pane nothing docks, and every way a gesture ends clears the target.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFloatGesture } from './useFloatGesture';
import type { DockSink } from './useFloatGesture';
import type { Dispatch } from '../state/StateContext';
import { singlePane } from '../windows/splitTree';
import { splitPane } from '../windows/splitTreeOps';

/** Two panes side by side: p1 on the left half, p2 on the right half. */
const TREE = splitPane(singlePane('p1', 'w1'), 'p1', 'row', 'p2', 'w2');

/** The action that docks f1 on the right of p2. */
const DOCK = {
  type: 'layout',
  action: { type: 'dockAt', floatPaneId: 'f1', targetPaneId: 'p2', edge: 'right' },
};

/** A button that starts a move and one that starts a resize, over `TREE`. */
function Harness(props: {
  readonly dispatch: Dispatch;
  readonly onTarget: DockSink['onTarget'];
}): JSX.Element {
  const layerRef = useRef<HTMLDivElement>(null);
  const begin = useFloatGesture(layerRef, props.dispatch, {
    tree: TREE,
    onTarget: props.onTarget,
  });
  return (
    <div ref={layerRef}>
      <button type="button" onPointerDown={begin('f1', 'move')}>
        drag
      </button>
      <button type="button" onPointerDown={begin('f1', 'resize')}>
        size
      </button>
    </div>
  );
}

/** Presses the named button. */
function press(name: string): void {
  fireEvent.pointerDown(screen.getByRole('button', { name }));
}

describe('useFloatGesture docking', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 1000, 500),
    );
  });

  it('reports the pane and edge under the pointer while Shift is held', () => {
    const onTarget = vi.fn();
    render(<Harness dispatch={vi.fn()} onTarget={onTarget} />);

    press('drag');
    fireEvent.pointerMove(document, { clientX: 900, clientY: 250, shiftKey: true });

    expect(onTarget).toHaveBeenLastCalledWith({
      paneId: 'p2',
      edge: 'right',
      zone: { x: 0.75, y: 0, w: 0.25, h: 1 },
    });
  });

  it('docks on release with Shift held', () => {
    const dispatch = vi.fn();
    render(<Harness dispatch={dispatch} onTarget={vi.fn()} />);

    press('drag');
    fireEvent.pointerMove(document, { clientX: 900, clientY: 250, shiftKey: true });
    fireEvent.pointerUp(document, { clientX: 900, clientY: 250, shiftKey: true });

    expect(dispatch).toHaveBeenLastCalledWith(DOCK);
  });

  it('only moves without Shift', () => {
    const dispatch = vi.fn();
    const onTarget = vi.fn();
    render(<Harness dispatch={dispatch} onTarget={onTarget} />);

    press('drag');
    fireEvent.pointerMove(document, { clientX: 900, clientY: 250 });
    fireEvent.pointerUp(document, { clientX: 900, clientY: 250 });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalledWith(DOCK);
    expect(onTarget).toHaveBeenLastCalledWith(null);
  });

  it('does not dock when Shift is released before the pointer is', () => {
    const dispatch = vi.fn();
    render(<Harness dispatch={dispatch} onTarget={vi.fn()} />);

    press('drag');
    fireEvent.pointerMove(document, { clientX: 900, clientY: 250, shiftKey: true });
    fireEvent.pointerUp(document, { clientX: 900, clientY: 250 });

    expect(dispatch).not.toHaveBeenCalledWith(DOCK);
  });

  it('does not dock a release outside every pane', () => {
    const dispatch = vi.fn();
    render(<Harness dispatch={dispatch} onTarget={vi.fn()} />);

    press('drag');
    fireEvent.pointerUp(document, { clientX: 5000, clientY: 250, shiftKey: true });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('never docks a resize', () => {
    const dispatch = vi.fn();
    const onTarget = vi.fn();
    render(<Harness dispatch={dispatch} onTarget={onTarget} />);

    press('size');
    fireEvent.pointerMove(document, { clientX: 900, clientY: 250, shiftKey: true });
    fireEvent.pointerUp(document, { clientX: 900, clientY: 250, shiftKey: true });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(onTarget).not.toHaveBeenCalledWith(expect.objectContaining({ paneId: 'p2' }));
  });

  it('clears the target when the gesture is cancelled', () => {
    const onTarget = vi.fn();
    render(<Harness dispatch={vi.fn()} onTarget={onTarget} />);

    press('drag');
    fireEvent.pointerCancel(document);

    expect(onTarget).toHaveBeenCalledTimes(1);
    expect(onTarget).toHaveBeenLastCalledWith(null);
  });

  it('clears the target when a new gesture replaces the one in progress', () => {
    const onTarget = vi.fn();
    render(<Harness dispatch={vi.fn()} onTarget={onTarget} />);

    press('drag');
    press('drag');

    expect(onTarget).toHaveBeenCalledTimes(1);
    expect(onTarget).toHaveBeenLastCalledWith(null);
  });

  it('clears the target when it unmounts mid-gesture', () => {
    const onTarget = vi.fn();
    const { unmount } = render(<Harness dispatch={vi.fn()} onTarget={onTarget} />);

    press('drag');
    unmount();

    expect(onTarget).toHaveBeenCalledTimes(1);
    expect(onTarget).toHaveBeenLastCalledWith(null);
  });
});
