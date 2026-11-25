/**
 * Shared setup for the PostCard tests: a plain public post by someone else,
 * with no action-bar commands, and a renderer that hands back the view and
 * fresh spies for the three actions a card reports.
 */
import { render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { vi } from 'vitest';

import type { PostActionLine } from './postActionTypes';
import { PostCard } from './PostCard';
import type { PostCardProps } from './PostCard';

/** The pictures of the author and the booster. */
export const AVATAR = { src: 'https://m.example/a.gif', staticSrc: 'https://m.example/a.png' };

/** A plain public post by Alice, nobody has answered, boosted or favourited. */
export const BASE_PROPS: PostCardProps = {
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
  media: [],
  sensitive: false,
  autoExpand: false,
  visibility: 'public',
  counts: { replies: 0, boosts: 0, favourites: 0 },
  mine: { boosted: false, favourited: false, bookmarked: false },
  reactions: [],
  edited: false,
  selected: false,
  showAvatar: true,
  showImages: true,
  recipients: [],
  chat: null,
  onToggleReveal: vi.fn<() => void>(),
  onSelect: vi.fn<() => void>(),
  onSelectAuthor: vi.fn<() => void>(),
  onContentLink: vi.fn<(href: string) => boolean>().mockReturnValue(false),
  actionLines: {},
  onAction: vi.fn<(line: PostActionLine) => void>(),
};

/** What {@link renderCard} returns: the view and the spies of the card's callbacks. */
type RenderedCard = {
  readonly view: RenderResult;
  readonly onToggleReveal: () => void;
  readonly onSelect: () => void;
  readonly onSelectAuthor: () => void;
};

/** Render one card with fresh mocks for the three actions. */
export function renderCard(overrides: Partial<PostCardProps> = {}): RenderedCard {
  const onToggleReveal = vi.fn<() => void>();
  const onSelect = vi.fn<() => void>();
  const onSelectAuthor = vi.fn<() => void>();
  const view = render(
    <PostCard
      {...BASE_PROPS}
      {...overrides}
      onToggleReveal={onToggleReveal}
      onSelect={onSelect}
      onSelectAuthor={onSelectAuthor}
    />,
  );
  return { view, onToggleReveal, onSelect, onSelectAuthor };
}
