/**
 * Tests for the media lines of the post row: the placeholders it draws below
 * the body from the media props, that pressing one opens the attachment
 * without selecting the row, and the sensitive and auto-expand flags it hands
 * down to MediaList. What the opened lines contain is MediaList's own test.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { MediaItem } from './MediaList';
import { PostRow } from './PostRow';
import type { PostRowProps } from './PostRow';

const BASE_PROPS: PostRowProps = {
  label: 'a3',
  date: new Date(2026, 0, 2, 23, 4),
  clockFormat: '24h',
  author: { handle: 'alice', fullHandle: '@alice@m.example', self: false },
  boostedBy: null,
  replyTo: null,
  quote: null,
  contentHtml: '<p>present day, present time</p>',
  spoilerText: '',
  revealed: false,
  poll: null,
  media: [],
  sensitive: false,
  autoExpand: false,
  visibility: 'public',
  counts: { replies: 0, boosts: 0, favourites: 0 },
  mine: { boosted: false, favourited: false, bookmarked: false },
  reactions: [],
  edited: false,
  selected: false,
  onToggleReveal: vi.fn<() => void>(),
  onSelect: vi.fn<() => void>(),
  onSelectAuthor: vi.fn<() => void>(),
};

/** One described image attachment with its own preview. */
const MEDIA: readonly MediaItem[] = [
  {
    id: 'm1',
    type: 'image',
    url: 'https://m.example/media/full.png',
    previewUrl: 'https://m.example/media/small.png',
    description: 'a wall',
  },
];

/** Render one row over {@link MEDIA} with fresh mocks and these overrides. */
function renderMediaPost(overrides: Partial<PostRowProps> = {}) {
  const onSelect = vi.fn<() => void>();
  const view = render(
    <PostRow
      {...BASE_PROPS}
      media={MEDIA}
      {...overrides}
      onSelect={onSelect}
      onToggleReveal={vi.fn<() => void>()}
      onSelectAuthor={vi.fn<() => void>()}
    />,
  );
  return { view, onSelect };
}

describe('PostRow media lines', () => {
  it('shows no media line for a post without attachments', () => {
    const { view } = renderMediaPost({ media: [] });

    expect(screen.queryByRole('button', { name: /\[(IMG|GIF|VID|AUD|FILE) \d/u })).toBeNull();
    expect(view.container.textContent).toBe('[a3] 23:04 <alice> present day, present time');
  });

  it('draws one placeholder line per attachment below the body', () => {
    const { view } = renderMediaPost();

    expect(screen.getByRole('button', { name: '[IMG 1/1: a wall]' })).toBeInTheDocument();
    expect(view.container.textContent).toBe(
      '[a3] 23:04 <alice> present day, present time[IMG 1/1: a wall]',
    );
  });

  it('opens an attachment from its placeholder without selecting the row', () => {
    const { onSelect } = renderMediaPost();

    fireEvent.click(screen.getByRole('button', { name: '[IMG 1/1: a wall]' }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('img', { name: 'a wall' })).toBeInTheDocument();
  });

  it('opens an attachment at once when the row auto-expands media', () => {
    renderMediaPost({ autoExpand: true });

    expect(screen.getByRole('img', { name: 'a wall' })).toBeInTheDocument();
  });

  it('never auto-expands the media of a sensitive post', () => {
    renderMediaPost({ sensitive: true, autoExpand: true });

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('button', { name: '[SENSITIVE] [IMG 1/1: a wall]' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
