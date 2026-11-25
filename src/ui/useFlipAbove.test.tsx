/**
 * Tests for where a popup opens (WFE-265): under its anchor, and above it
 * only when it would run past the bottom of the screen or of the scrollback
 * it sits in and the room above holds it. jsdom lays nothing out, so the
 * rectangles are the test's own, handed to the three measurements the hook
 * makes in order: the anchor, the popup, then the scrollback if there is one.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EmojiPicker } from './EmojiPicker';
import { opensAbove } from './useFlipAbove';

/** A rectangle from its top edge and its height; the width is of no matter. */
function rect(top: number, height: number): DOMRect {
  const bottom = top + height;
  return {
    x: 0,
    y: top,
    width: 100,
    height,
    top,
    bottom,
    left: 0,
    right: 100,
    toJSON: () => ({ top, bottom }),
  };
}

/** Open the picker with these measurements, inside a scrollback when `inLog` is set. */
function openWith(measures: readonly DOMRect[], inLog: boolean): HTMLElement {
  const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect');
  for (const measure of measures) {
    spy.mockReturnValueOnce(measure);
  }
  const picker = (
    <EmojiPicker
      data={{ custom: [], unicode: [] }}
      label="a4"
      onChoose={() => undefined}
      onClose={() => undefined}
      reactions={[]}
    />
  );
  render(inLog ? <div role="log">{picker}</div> : picker);
  return screen.getByRole('dialog');
}

describe(opensAbove, () => {
  it('opens above only when it passes the limit and fits above the anchor', () => {
    expect(opensAbove(rect(600, 300), rect(580, 20), 768)).toBe(true);
    expect(opensAbove(rect(400, 300), rect(380, 20), 768)).toBe(false);
    expect(opensAbove(rect(600, 300), rect(200, 20), 768)).toBe(false);
  });
});

describe('the picker’s place', () => {
  it('opens under the button when it fits', () => {
    expect(openWith([rect(580, 20), rect(600, 100)], false)).not.toHaveAttribute('data-above');
  });

  it('flips above the button when the screen has no room below', () => {
    expect(openWith([rect(580, 20), rect(600, 300)], false)).toHaveAttribute('data-above');
  });

  it('stays under the button when there is no room above either', () => {
    expect(openWith([rect(100, 20), rect(120, 900)], false)).not.toHaveAttribute('data-above');
  });

  it('flips when the scrollback ends before the screen does', () => {
    const log = rect(0, 500);

    expect(openWith([rect(400, 20), rect(420, 100), log], true)).toHaveAttribute('data-above');
  });

  it('stays under the button when it fits in the scrollback', () => {
    const log = rect(0, 700);

    expect(openWith([rect(400, 20), rect(420, 100), log], true)).not.toHaveAttribute('data-above');
  });
});
