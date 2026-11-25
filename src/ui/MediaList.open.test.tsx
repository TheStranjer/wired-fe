/**
 * Tests for opening a list's attachments in the media window (WFE-264): a plain
 * click on an opened image or file link asks for that attachment's zero-based
 * index and keeps the browser from leaving, a modified click and a list with
 * no handler leave the link native, and the link still holds the full file.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MediaList } from './MediaList';
import type { MediaItem } from './MediaList';

const URL = 'https://m.example/media/full.png';

/** One attachment of {@link type}, with a distinct id. */
function item(id: string, type: MediaItem['type'] = 'image'): MediaItem {
  return { id, type, url: URL, previewUrl: null, description: id };
}

/** Render an expanded list over {@link items}, with {@link onOpenMedia} if given. */
function renderList(
  items: readonly MediaItem[],
  onOpenMedia?: (index: number) => void,
): ReturnType<typeof render> {
  return render(<MediaList autoExpand items={items} onOpenMedia={onOpenMedia} sensitive={false} />);
}

describe('MediaList onOpenMedia', () => {
  it('opens the clicked image by its index and stops the browser', () => {
    const open = vi.fn<(index: number) => void>();
    renderList([item('a'), item('b')], open);

    const proceeded = fireEvent.click(screen.getByRole('img', { name: 'b' }));

    expect(open).toHaveBeenCalledExactlyOnceWith(1);
    expect(proceeded).toBe(false);
  });

  it('opens an unknown file from its link line', () => {
    const open = vi.fn<(index: number) => void>();
    renderList([item('a'), item('b', 'unknown')], open);

    fireEvent.click(screen.getByRole('link', { name: URL }));

    expect(open).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('leaves a Ctrl-click to the browser and keeps the full file in the href', () => {
    const open = vi.fn<(index: number) => void>();
    renderList([item('a')], open);

    const proceeded = fireEvent.click(screen.getByRole('link'), { ctrlKey: true });

    expect(open).not.toHaveBeenCalled();
    expect(proceeded).toBe(true);
    expect(screen.getByRole('link')).toHaveAttribute('href', URL);
  });

  it('intercepts nothing without a handler', () => {
    renderList([item('a')]);

    expect(fireEvent.click(screen.getByRole('link'))).toBe(true);
  });
});
