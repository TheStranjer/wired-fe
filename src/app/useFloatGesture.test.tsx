/**
 * Tests for the float gesture hook (WFE-222): pointer steps become fractions
 * of the layer's size, a move or a resize action by gesture; a release,
 * cancel, new gesture or unmount ends the one before; a missing layer starts
 * nothing.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFloatGesture } from './useFloatGesture';
import type { Dispatch } from '../state/StateContext';

/** A button that starts a move, one that starts a resize, inside a layer that may be missing. */
function Harness(props: { readonly dispatch: Dispatch; readonly attached: boolean }): JSX.Element {
  const layerRef = useRef<HTMLDivElement>(null);
  const begin = useFloatGesture(layerRef, props.dispatch, { tree: null, onTarget: vi.fn() });
  return (
    <div ref={props.attached ? layerRef : null}>
      <button type="button" onPointerDown={begin('f1', 'move')}>
        drag
      </button>
      <button type="button" onPointerDown={begin('f1', 'resize')}>
        size
      </button>
    </div>
  );
}

/** The action a move step of (dx, dy) fractions dispatches. */
function moved(dx: number, dy: number): unknown {
  return { type: 'layout', action: { type: 'moveFloat', paneId: 'f1', dx, dy } };
}

describe(useFloatGesture, () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 1000, 500),
    );
  });

  it('dispatches each move step as a fraction of the layer', () => {
    const dispatch = vi.fn();
    render(<Harness dispatch={dispatch} attached />);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'drag' }), {
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(document, { clientX: 350, clientY: 225 });
    fireEvent.pointerMove(document, { clientX: 350, clientY: 100 });

    expect(dispatch).toHaveBeenNthCalledWith(1, moved(0.25, 0.25));
    expect(dispatch).toHaveBeenNthCalledWith(2, moved(0, -0.25));
  });

  it('dispatches resize steps as size deltas', () => {
    const dispatch = vi.fn();
    render(<Harness dispatch={dispatch} attached />);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'size' }), {
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(document, { clientX: 500, clientY: 50 });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'layout',
      action: { type: 'resizeFloat', paneId: 'f1', dw: 0.5, dh: 0.1 },
    });
  });

  it.each(['pointerUp', 'pointerCancel'] as const)('stops following after %s', (release) => {
    const dispatch = vi.fn();
    render(<Harness dispatch={dispatch} attached />);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'drag' }));
    fireEvent[release](document);
    fireEvent.pointerMove(document, { clientX: 500, clientY: 50 });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('lets a new gesture replace the one in progress', () => {
    const dispatch = vi.fn();
    render(<Harness dispatch={dispatch} attached />);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'drag' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'drag' }));
    fireEvent.pointerMove(document, { clientX: 100, clientY: 0 });

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('stops following when it unmounts mid-gesture', () => {
    const dispatch = vi.fn();
    const { unmount } = render(<Harness dispatch={dispatch} attached />);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'drag' }));
    unmount();
    fireEvent.pointerMove(document, { clientX: 100, clientY: 0 });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('starts nothing without a layer', () => {
    const dispatch = vi.fn();
    render(<Harness dispatch={dispatch} attached={false} />);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'drag' }));
    fireEvent.pointerMove(document, { clientX: 100, clientY: 0 });

    expect(dispatch).not.toHaveBeenCalled();
  });
});
