/**
 * Tests for the quote line of the post row (WFE-99): the dim `┌` excerpt line
 * the row draws under its own, the silence when the quote prop is null, and
 * the row click a quote hands up. What the line is made of is ./QuoteBlock's
 * own test.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PostRow } from './PostRow';
import type { PostRowProps } from './PostRow';
import type { QuoteBlockProps } from './QuoteBlock';

const QUOTE: QuoteBlockProps = {
  label: 'a4',
  author: { handle: 'bob', fullHandle: '@bob@m.example' },
  excerpt: 'the wired is all one network.',
};

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

describe('PostRow quote line', () => {
  it('draws the quoted post as a line under the row', () => {
    const { container } = render(<PostRow {...BASE_PROPS} quote={QUOTE} />);

    expect(container.textContent).toBe(
      '[a3] 23:04 <alice> present day, present time     ┌ [a4] <bob> the wired is all one network.',
    );
    expect(screen.getByText('┌')).toHaveAttribute('aria-hidden', 'true');
  });

  it('leaves an unquoted post without a quote line', () => {
    const { container } = render(<PostRow {...BASE_PROPS} />);

    expect(container.textContent).not.toContain('┌');
    expect(container.querySelector('div')).toBeNull();
  });

  it('selects the row when its quote line is clicked', () => {
    const onSelect = vi.fn<() => void>();
    render(<PostRow {...BASE_PROPS} quote={{ ...QUOTE, label: null }} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('the wired is all one network.'));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('keeps the quote line under the row it quotes', () => {
    const { container } = render(<PostRow {...BASE_PROPS} quote={{ ...QUOTE, label: null }} />);

    expect(container.textContent).toBe(
      '[a3] 23:04 <alice> present day, present time     ┌ <bob> the wired is all one network.',
    );
  });
});
