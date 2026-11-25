/**
 * Tests for opening a grid's attachments in the media window (WFE-264): a plain
 * click on an image or file link asks for that attachment's zero-based index
 * and keeps the browser from leaving, a modified or middle click and a grid
 * with no handler leave the link native, the link still holds the full file,
 * the `+N` button and the sensitive cover never open anything.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FULL_URL, images, item, renderGrid } from './mediaGridHarness';

describe('MediaGrid onOpenMedia', () => {
  it('opens the clicked image by its index and stops the browser', () => {
    const open = vi.fn<(index: number) => void>();
    renderGrid(images(3), { onOpenMedia: open });

    const proceeded = fireEvent.click(screen.getByRole('img', { name: 'image 2' }));

    expect(open).toHaveBeenCalledExactlyOnceWith(1);
    expect(proceeded).toBe(false);
  });

  it('leaves a Ctrl-click to the browser and keeps the full file in the href', () => {
    const open = vi.fn<(index: number) => void>();
    renderGrid([item()], { onOpenMedia: open });

    const proceeded = fireEvent.click(screen.getByRole('link'), { ctrlKey: true });

    expect(open).not.toHaveBeenCalled();
    expect(proceeded).toBe(true);
    expect(screen.getByRole('link')).toHaveAttribute('href', FULL_URL);
  });

  it('intercepts nothing without a handler', () => {
    renderGrid([item()]);

    expect(fireEvent.click(screen.getByRole('link'))).toBe(true);
  });

  it('opens an unknown file from its link line', () => {
    const open = vi.fn<(index: number) => void>();
    renderGrid([item({ id: 'a' }), item({ id: 'b', type: 'unknown' })], { onOpenMedia: open });

    const proceeded = fireEvent.click(screen.getByRole('link', { name: FULL_URL }));

    expect(open).toHaveBeenCalledExactlyOnceWith(1);
    expect(proceeded).toBe(false);
  });

  it('does not open anything from the +N button', () => {
    const open = vi.fn<(index: number) => void>();
    renderGrid(images(6), { onOpenMedia: open });

    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more attachments' }));

    expect(open).not.toHaveBeenCalled();
    expect(screen.getAllByRole('img')).toHaveLength(6);
  });

  it('only reveals on the first click of a sensitive cover', () => {
    const open = vi.fn<(index: number) => void>();
    renderGrid([item()], { onOpenMedia: open, sensitive: true });

    fireEvent.click(screen.getByRole('button', { name: '[ SENSITIVE — show ]' }));

    expect(open).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('link'));

    expect(open).toHaveBeenCalledExactlyOnceWith(0);
  });
});
