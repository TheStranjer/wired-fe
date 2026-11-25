/**
 * Tests for the media of the post card: its attachments reach the grid, and a
 * post whose body is still behind its content warning keeps them covered until
 * the warning is revealed.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { MediaItem } from './MediaList';
import { PostCard } from './PostCard';
import type { PostCardProps } from './PostCard';

const AVATAR = { src: 'https://m.example/a.gif', staticSrc: 'https://m.example/a.png' };

const MEDIA: readonly MediaItem[] = [
  { id: 'm1', type: 'image', url: null, previewUrl: 'https://m.example/s.png', description: 'x' },
];

const BASE_PROPS: PostCardProps = {
  label: 'a3',
  date: new Date(2026, 0, 2, 23, 4),
  clockFormat: '24h',
  author: {
    handle: 'alice',
    fullHandle: '@alice@m.example',
    self: false,
    avatar: AVATAR,
    displayName: 'Alice',
    displayNameEmojis: [],
  },
  boostedBy: null,
  replyTo: null,
  quote: null,
  contentHtml: '<p>present day, present time</p>',
  emojis: [],
  spoilerText: '',
  revealed: false,
  poll: null,
  media: MEDIA,
  sensitive: false,
  autoExpand: false,
  visibility: 'public',
  counts: { replies: 0, boosts: 0, favourites: 0 },
  mine: { boosted: false, favourited: false, bookmarked: false },
  reactions: [],
  edited: false,
  selected: false,
  showAvatar: true,
  onToggleReveal: vi.fn<() => void>(),
  onSelect: vi.fn<() => void>(),
  onSelectAuthor: vi.fn<() => void>(),
  onContentLink: () => false,
};

describe('PostCard media', () => {
  it('draws the attachments inline', () => {
    render(<PostCard {...BASE_PROPS} />);

    expect(screen.getByRole('img', { name: 'x' })).toBeInTheDocument();
  });

  it('covers them while the body is behind its content warning', () => {
    render(<PostCard {...BASE_PROPS} spoilerText="spoilers" />);

    expect(screen.getByRole('button', { name: /SENSITIVE/u })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'x' })).toBeNull();
  });

  it('shows them once the warning is revealed', () => {
    render(<PostCard {...BASE_PROPS} revealed spoilerText="spoilers" />);

    expect(screen.getByRole('img', { name: 'x' })).toBeInTheDocument();
  });
});
