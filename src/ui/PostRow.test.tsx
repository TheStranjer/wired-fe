/**
 * Tests for the post row: the one-line chat content and its order, who
 * boosted the post above it, who it answers before the body, the metadata
 * suffix after it, the selected marking, and click routing between the row,
 * the nick and the CW button. The body's own states are tested with the
 * component that renders them, ./PostBody; the media lines below it with
 * ./PostRow.media; the poll under it with ./PostRow.poll; the quote line
 * under it with ./PostRow.quote; keeping the selection in view with
 * ./LineView.scroll.
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
  onContentLink: () => false,
};

/** Render one row with fresh mocks for all three actions. */
function renderPost(overrides: Partial<PostRowProps> = {}) {
  const onToggleReveal = vi.fn<() => void>();
  const onSelect = vi.fn<() => void>();
  const onSelectAuthor = vi.fn<() => void>();
  const view = render(
    <PostRow
      {...BASE_PROPS}
      {...overrides}
      onToggleReveal={onToggleReveal}
      onSelect={onSelect}
      onSelectAuthor={onSelectAuthor}
    />,
  );
  return { view, onToggleReveal, onSelect, onSelectAuthor };
}

/** The row's own mark on a boost, a favourite and a bookmark, with tallies. */
const MINE: Partial<PostRowProps> = {
  counts: { replies: 2, boosts: 1, favourites: 5 },
  mine: { boosted: true, favourited: true, bookmarked: true },
  reactions: [{ name: '🔥', count: 2, me: true, url: null }],
  edited: true,
};

describe(PostRow, () => {
  it('renders label, clock, nick and content as one line', () => {
    const { view } = renderPost();

    expect(view.container.textContent).toBe('[a3] 23:04 <alice> present day, present time');
  });

  it('is an article named by label and full handle', () => {
    renderPost();

    expect(screen.getByRole('article', { name: 'Post a3 by @alice@m.example' })).toBeVisible();
  });

  it('names who boosted the post on the line above it', () => {
    const { view } = renderPost({
      boostedBy: { handle: 'bob', fullHandle: '@bob@m.example' },
    });

    expect(view.container.textContent).toBe(
      '⟳ <bob> boosted[a3] 23:04 <alice> present day, present time',
    );
    expect(screen.getByText('⟳')).toHaveAttribute('aria-hidden', 'true');
  });

  it('leaves an unboosted post without a boost line', () => {
    const { view } = renderPost();

    expect(view.container.querySelector('div')).toBeNull();
    expect(view.container.textContent).not.toContain('boosted');
  });

  it('names the account a reply answers before the body', () => {
    const { view } = renderPost({ replyTo: '@carol' });

    expect(view.container.textContent).toBe(
      '[a3] 23:04 <alice> ↳ re @carol: present day, present time',
    );
  });

  it('says a thread when the account it answers is not known', () => {
    const { view } = renderPost({ replyTo: 'a thread' });

    expect(view.container.textContent).toBe(
      '[a3] 23:04 <alice> ↳ re a thread: present day, present time',
    );
  });

  it('shows the audience glyph after the body, with its words', () => {
    const { view } = renderPost({ visibility: 'direct', contentHtml: '<p>present day</p>' });

    expect(screen.getByTitle('direct')).toBeInTheDocument();
    expect(screen.getByText('direct')).toBeInTheDocument();
    expect(view.container.textContent).toBe('[a3] 23:04 <alice> present day direct✉');
  });

  it('shows no audience glyph to the whole wired', () => {
    renderPost();

    expect(screen.queryByTitle('public')).toBeNull();
  });

  it('tallies replies, boosts and favourites after the body', () => {
    const { view } = renderPost(MINE);

    expect(view.container.textContent).toBe(
      '[a3] 23:04 <alice> present day, present time  ↩2 ⟳1 ★5 🔖 🔥2 (edited)',
    );
    expect(screen.getByText('⟳1')).toHaveAttribute('title', 'you boosted this');
    expect(screen.getByTitle('you reacted with 🔥')).toHaveTextContent('🔥2');
  });

  it('shows one post as the row the ticket asks for', () => {
    const { view } = renderPost({
      boostedBy: { handle: 'bob', fullHandle: '@bob@m.example' },
      replyTo: '@carol',
      visibility: 'direct',
      contentHtml: '<p>present day</p>',
      counts: { replies: 2, boosts: 1, favourites: 5 },
      mine: { boosted: false, favourited: true, bookmarked: false },
      reactions: [{ name: '🔥', count: 2, me: false, url: null }],
      edited: true,
    });

    expect(view.container.textContent).toBe(
      '⟳ <bob> boosted[a3] 23:04 <alice> ↳ re @carol: present day direct✉  ↩2 ⟳1 ★5 🔥2 (edited)',
    );
  });

  it('renders a known shortcode in the body as its emoji image', () => {
    renderPost({
      contentHtml: '<p>:cat: approved</p>',
      emojis: [{ shortcode: 'cat', url: 'https://example.org/cat.png' }],
    });

    expect(screen.getByRole('img', { name: ':cat:' })).toHaveAttribute(
      'src',
      'https://example.org/cat.png',
    );
  });

  it('toggles the warning from its button, which the row click leaves alone', () => {
    const { onToggleReveal, onSelect } = renderPost({ spoilerText: 'spoilers' });

    fireEvent.click(screen.getByRole('button', { name: '[CW: spoilers]' }));

    expect(onToggleReveal).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps the tallies after a content warning', () => {
    const { view } = renderPost({
      spoilerText: 'lain spoilers',
      contentHtml: '<p>the fourth wall</p>',
      revealed: true,
      visibility: 'unlisted',
      counts: { replies: 1, boosts: 0, favourites: 0 },
    });

    expect(view.container.textContent).toBe(
      '[a3] 23:04 <alice> [CW: lain spoilers] the fourth wall unlisted~  ↩1',
    );
  });

  it('marks the selected row with aria-current', () => {
    renderPost({ selected: true });

    expect(screen.getByRole('article')).toHaveAttribute('aria-current', 'true');
  });

  it('leaves an unselected row without aria-current', () => {
    renderPost();

    expect(screen.getByRole('article')).not.toHaveAttribute('aria-current');
  });

  it('selects the row when its text is clicked', () => {
    const { onSelect } = renderPost();

    fireEvent.click(screen.getByText('[a3]'));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('selects the row when the boost line is clicked', () => {
    const { onSelect } = renderPost({ boostedBy: { handle: 'bob', fullHandle: '@bob@m.example' } });

    fireEvent.click(screen.getByText('boosted'));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('opens the author when the nick is clicked, without selecting', () => {
    const { onSelect, onSelectAuthor } = renderPost();

    fireEvent.click(screen.getByRole('button', { name: '@alice@m.example' }));

    expect(onSelectAuthor).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
