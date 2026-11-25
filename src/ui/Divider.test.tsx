/**
 * Tests for the pane divider (WFE-221): its aria values, keyboard resizing,
 * double-click reset, and a pointer drag measured against a mocked container.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import type { JSX } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Divider } from './Divider';

const BOUNDS = { min: 0.1, max: 0.9 };

/** Divider props a test varies. */
type HarnessProps = {
  readonly orientation?: 'vertical' | 'horizontal';
  readonly ratio?: number;
  readonly onRatioChange: (ratio: number) => void;
};

/** A divider inside the container it measures against. */
function Harness(props: HarnessProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={containerRef}>
      <Divider
        bounds={BOUNDS}
        containerRef={containerRef}
        onRatioChange={props.onRatioChange}
        orientation={props.orientation ?? 'vertical'}
        ratio={props.ratio ?? 0.5}
      />
    </div>
  );
}

/** Fires a pointer event of `type` at `target` with the given coordinates. */
function pointer(
  type: string,
  target: Element,
  init: { clientX?: number; clientY?: number },
): void {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, 'pointerId', { value: 7 });
  fireEvent(target, event);
}

/** Makes the divider's container 400x200 at (100, 50). */
function sizeContainer(): void {
  const container = screen.getByRole('separator').parentElement;
  if (container === null) {
    throw new Error('divider has no container');
  }
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    top: 50,
    width: 400,
    height: 200,
  } as DOMRect);
}

describe(Divider, () => {
  const capture = vi.fn();

  beforeEach(() => {
    capture.mockClear();
    HTMLElement.prototype.setPointerCapture = capture;
  });

  it('is a focusable separator with its ratio as aria values', () => {
    render(<Harness onRatioChange={vi.fn()} ratio={0.35} />);

    const divider = screen.getByRole('separator', { name: 'Resize panes' });

    expect(divider).toHaveAttribute('aria-orientation', 'vertical');
    expect(divider).toHaveAttribute('aria-valuenow', '35');
    expect(divider).toHaveAttribute('aria-valuemin', '10');
    expect(divider).toHaveAttribute('aria-valuemax', '90');
    expect(divider).toHaveAttribute('tabindex', '0');
  });

  it('is horizontal between stacked panes', () => {
    render(<Harness onRatioChange={vi.fn()} orientation="horizontal" />);

    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('steps the ratio by 5% with the arrow keys', () => {
    const onRatioChange = vi.fn();
    render(<Harness onRatioChange={onRatioChange} />);
    const divider = screen.getByRole('separator');

    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    fireEvent.keyDown(divider, { key: 'ArrowLeft' });

    expect(onRatioChange).toHaveBeenNthCalledWith(1, 0.55);
    expect(onRatioChange).toHaveBeenNthCalledWith(2, 0.45);
  });

  it('jumps to the bounds with Home and End', () => {
    const onRatioChange = vi.fn();
    render(<Harness onRatioChange={onRatioChange} />);
    const divider = screen.getByRole('separator');

    fireEvent.keyDown(divider, { key: 'Home' });
    fireEvent.keyDown(divider, { key: 'End' });

    expect(onRatioChange).toHaveBeenNthCalledWith(1, 0.1);
    expect(onRatioChange).toHaveBeenNthCalledWith(2, 0.9);
  });

  it('ignores other keys', () => {
    const onRatioChange = vi.fn();
    render(<Harness onRatioChange={onRatioChange} />);

    fireEvent.keyDown(screen.getByRole('separator'), { key: 'a' });

    expect(onRatioChange).not.toHaveBeenCalled();
  });

  it('resets to an even split on double-click', () => {
    const onRatioChange = vi.fn();
    render(<Harness onRatioChange={onRatioChange} ratio={0.2} />);

    fireEvent.doubleClick(screen.getByRole('separator'));

    expect(onRatioChange).toHaveBeenCalledWith(0.5);
  });

  it('follows the pointer along x for a vertical divider while it is held', () => {
    const onRatioChange = vi.fn();
    render(<Harness onRatioChange={onRatioChange} />);
    sizeContainer();
    const divider = screen.getByRole('separator');

    pointer('pointerdown', divider, { clientX: 300 });
    pointer('pointermove', divider, { clientX: 200 });
    pointer('pointermove', divider, { clientX: 5000 });

    expect(capture).toHaveBeenCalledWith(7);
    expect(onRatioChange).toHaveBeenNthCalledWith(1, 0.25);
    expect(onRatioChange).toHaveBeenNthCalledWith(2, 0.9);
  });

  it('follows the pointer along y for a horizontal divider', () => {
    const onRatioChange = vi.fn();
    render(<Harness onRatioChange={onRatioChange} orientation="horizontal" />);
    sizeContainer();
    const divider = screen.getByRole('separator');

    pointer('pointerdown', divider, {});
    pointer('pointermove', divider, { clientY: 100 });

    expect(onRatioChange).toHaveBeenCalledWith(0.25);
  });

  it('ignores moves before the press and after the release', () => {
    const onRatioChange = vi.fn();
    render(<Harness onRatioChange={onRatioChange} />);
    sizeContainer();
    const divider = screen.getByRole('separator');

    pointer('pointermove', divider, { clientX: 200 });
    pointer('pointerdown', divider, { clientX: 300 });
    pointer('pointerup', divider, { clientX: 300 });
    pointer('pointermove', divider, { clientX: 200 });

    expect(onRatioChange).not.toHaveBeenCalled();
  });

  it('stops following the pointer when the gesture is cancelled', () => {
    const onRatioChange = vi.fn();
    render(<Harness onRatioChange={onRatioChange} />);
    sizeContainer();
    const divider = screen.getByRole('separator');

    pointer('pointerdown', divider, { clientX: 300 });
    pointer('pointercancel', divider, {});
    pointer('pointermove', divider, { clientX: 200 });

    expect(onRatioChange).not.toHaveBeenCalled();
  });
});
