/**
 * Tests for the media of the post card: its attachments reach the grid, and a
 * post whose body is still behind its content warning keeps them covered until
 * the warning is revealed.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { MediaItem } from './MediaList';
import { PostCard } from './PostCard';
import type { PostCardProps } from './PostCard';
import { BASE_PROPS as CARD_PROPS } from './postCardHarness';

const MEDIA: readonly MediaItem[] = [
  { id: 'm1', type: 'image', url: null, previewUrl: 'https://m.example/s.png', description: 'x' },
];

const BASE_PROPS: PostCardProps = { ...CARD_PROPS, media: MEDIA };

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
