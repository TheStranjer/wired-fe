/**
 * Tests for the docked layout (WFE-207, WFE-286, WFE-289): the scrollback sits
 * over the box, files pasted or dropped onto the pane go to the box's media
 * and stop there, a drag that carries no file passes, and a pane with no box
 * takes no files.
 */
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DockedInput } from './DockedInput';

/** A drag or paste payload carrying {@link files}. */
function carrying(files: readonly File[]): Record<string, unknown> {
  return { types: ['Files'], files };
}

const PIC = new File(['pixels'], 'cat.png', { type: 'image/png' });

/** The layout over a scrollback and, unless {@link box} is null, a box; the spy gets the files. */
function show(box: string | null): () => void {
  const onFiles = vi.fn();
  render(
    <DockedInput input={box} onFiles={onFiles}>
      <p>scrollback</p>
    </DockedInput>,
  );
  return onFiles;
}

describe(DockedInput, () => {
  it('shows the scrollback and the box', () => {
    show('the box');

    expect(screen.getByText('scrollback')).toBeInTheDocument();
    expect(screen.getByText('the box')).toBeInTheDocument();
  });

  it('hands pasted files over and keeps the paste from the window', () => {
    const onFiles = show('the box');
    const event = createEvent.paste(screen.getByText('the box'), {
      clipboardData: carrying([PIC]),
    });

    fireEvent(screen.getByText('the box'), event);

    expect(onFiles).toHaveBeenCalledWith([PIC]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('hands dropped files over, framing the pane while they are dragged over it', () => {
    const onFiles = show('the box');
    const pane = screen.getByText('scrollback');

    fireEvent(pane, createEvent.dragOver(pane, { dataTransfer: carrying([PIC]) }));
    fireEvent(pane, createEvent.drop(pane, { dataTransfer: carrying([PIC]) }));

    expect(onFiles).toHaveBeenCalledWith([PIC]);
  });

  it('lets a drag that carries no files pass', () => {
    const onFiles = show('the box');
    const pane = screen.getByText('scrollback');
    const over = createEvent.dragOver(pane, { dataTransfer: { types: ['text/plain'], files: [] } });

    fireEvent(pane, over);
    fireEvent.dragLeave(pane);

    expect(over.defaultPrevented).toBe(false);
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('takes no files while it has no box', () => {
    const onFiles = show(null);
    const pane = screen.getByText('scrollback');
    const drop = createEvent.drop(pane, { dataTransfer: carrying([PIC]) });

    fireEvent(pane, drop);

    expect(drop.defaultPrevented).toBe(false);
    expect(onFiles).not.toHaveBeenCalled();
  });
});
