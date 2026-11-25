/**
 * Tests for the double-click that pops a post row out (WFE-241): a
 * double-click on the row's text asks `onPop` once; on a body link or the nick
 * it does not.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PostRow } from './PostRow';
import type { PostRowProps } from './PostRow';

const BASE_PROPS: PostRowProps = {
  label: 'a3',
  date: new Date(2026, 0, 2, 23, 4),
  clockFormat: '24h',
  author: { handle: 'alice', fullHandle: '@alice@m.example', self: false },
  boostedBy: null,
  via: null,
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

/** Render one row whose pop is a fresh spy, over {@link overrides}; returns the spy. */
function renderPop(overrides: Partial<PostRowProps> = {}): () => void {
  const onPop = vi.fn<() => void>();
  render(<PostRow {...BASE_PROPS} {...overrides} onPop={onPop} />);
  return onPop;
}

describe('PostRow double-click', () => {
  it('pops the post when the row text is double-clicked', () => {
    const onPop = renderPop();

    fireEvent.doubleClick(screen.getByText('[a3]'));

    expect(onPop).toHaveBeenCalledTimes(1);
  });

  it('does not pop for a double-click on a link in the body', () => {
    const onPop = renderPop({
      contentHtml: '<p><a href="https://wired.example/tags/rust">#rust</a></p>',
    });

    fireEvent.doubleClick(screen.getByRole('link', { name: '#rust' }));

    expect(onPop).not.toHaveBeenCalled();
  });

  it('does not pop for a double-click on the nick', () => {
    const onPop = renderPop();

    fireEvent.doubleClick(screen.getByRole('button', { name: '@alice@m.example' }));

    expect(onPop).not.toHaveBeenCalled();
  });
});
