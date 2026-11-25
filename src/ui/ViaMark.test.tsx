/**
 * Tests for the account marker of a multi-account feed (decision 14, WFE-226):
 * `→ @me` on a card, `→me` on an IRC line, the full account list as its title
 * and accessible name, and its place in the card header, the post row and the
 * client-message line. Without a marker nothing is drawn.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PostCard, type PostCardProps } from './PostCard';
import { BASE_PROPS } from './postCardHarness';
import { PostRow, type PostRowProps } from './PostRow';
import { SystemLine } from './SystemLine';
import { type Via, ViaMark } from './ViaMark';

const VIA: Via = { label: 'me +1', full: '@me@w.example, @you@x.example' };

const ROW_PROPS: PostRowProps = {
  label: 'a3',
  date: new Date(2026, 0, 2, 23, 4),
  clockFormat: '24h',
  via: null,
  author: { handle: 'alice', fullHandle: '@alice@m.example', self: false },
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
  onToggleReveal: vi.fn<() => void>(),
  onSelect: vi.fn<() => void>(),
  onSelectAuthor: vi.fn<() => void>(),
  onPop: vi.fn<() => void>(),
  onContentLink: () => false,
};

const CARD_PROPS: PostCardProps = { ...BASE_PROPS, showAvatar: false };

describe(ViaMark, () => {
  it('writes the card form with a space after the arrow and an @', () => {
    render(<ViaMark form="card" via={{ label: 'me', full: '@me@w.example' }} />);

    expect(screen.getByRole('note')).toHaveTextContent('→ @me');
  });

  it('writes the line form with the handle against the arrow', () => {
    render(<ViaMark form="line" via={{ label: 'me', full: '@me@w.example' }} />);

    expect(screen.getByRole('note')).toHaveTextContent('→me');
  });

  it('names every account in its accessible name and title', () => {
    render(<ViaMark form="card" via={VIA} />);

    expect(screen.getByRole('note', { name: 'via @me@w.example, @you@x.example' })).toHaveAttribute(
      'title',
      '@me@w.example, @you@x.example',
    );
  });
});

describe('the marker in a post', () => {
  it('sits between the label and the clock of a card', () => {
    const { container } = render(<PostCard {...CARD_PROPS} via={VIA} />);

    expect(container.textContent).toContain('[a3]→ @me +123:04');
  });

  it('is absent from a card without one', () => {
    render(<PostCard {...CARD_PROPS} />);

    expect(screen.queryByRole('note')).toBeNull();
  });

  it('follows the clock of a row, before the nick', () => {
    const { container } = render(<PostRow {...ROW_PROPS} via={VIA} />);

    expect(container.textContent).toContain('[a3] 23:04 →me +1 <alice>');
  });

  it('is absent from a row without one', () => {
    render(<PostRow {...ROW_PROPS} />);

    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('the marker in a client message', () => {
  const MESSAGE = {
    date: new Date(2026, 0, 2, 23, 4),
    clockFormat: '24h',
    level: 'info',
    text: 'followed you',
  } as const;

  it('follows the clock, before the *** marker', () => {
    const { container } = render(<SystemLine {...MESSAGE} via={VIA} />);

    expect(container.textContent).toBe('23:04 →me +1 *** followed you');
  });

  it.each([null, undefined])('is absent when via is %s', (via) => {
    const { container } = render(<SystemLine {...MESSAGE} via={via} />);

    expect(container.textContent).toBe('23:04 *** followed you');
  });
});
