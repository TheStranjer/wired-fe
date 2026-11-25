/**
 * Tests for the post card: header parts, boost line, body and CW toggle,
 * quote, poll and media, avatars, selected marking, and click routing.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PostCard } from './PostCard';
import type { PostCardProps } from './PostCard';

const AVATAR = { src: 'https://m.example/a.gif', staticSrc: 'https://m.example/a.png' };

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
  onContentLink: () => false,
};

/** Render one card with fresh mocks for the three actions. */
function renderCard(overrides: Partial<PostCardProps> = {}) {
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

describe(PostCard, () => {
  it('is an article named by label and full handle', () => {
    renderCard();

    expect(screen.getByRole('article', { name: 'Post a3 by @alice@m.example' })).toBeVisible();
  });

  it('shows the label, the clock, the name, the handle and the body', () => {
    const { view } = renderCard();

    expect(view.container.textContent).toBe(
      '[a3]23:04Alice<@alice@m.example>present day, present time',
    );
    expect(screen.getByText('23:04')).toBeInTheDocument();
  });

  it('falls back to the handle when the display name is empty', () => {
    renderCard({ author: { ...BASE_PROPS.author, displayName: '' } });

    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('shows a display name as text, never as markup', () => {
    renderCard({ author: { ...BASE_PROPS.author, displayName: '<b>Al</b> & co' } });

    expect(screen.getByText('<b>Al</b> & co')).toBeInTheDocument();
  });

  it('renders a known shortcode in the display name as its emoji image', () => {
    renderCard({
      author: {
        ...BASE_PROPS.author,
        displayName: 'Alice :cat:',
        displayNameEmojis: [{ shortcode: 'cat', url: 'https://example.org/cat.png' }],
      },
    });

    expect(screen.getByRole('img', { name: ':cat:' })).toHaveAttribute(
      'src',
      'https://example.org/cat.png',
    );
  });

  it('names the account a reply answers beside the handle', () => {
    renderCard({ replyTo: '@carol' });

    expect(screen.getByText('↳ re @carol')).toBeInTheDocument();
  });

  it('shows no reply marker for a post that answers nobody', () => {
    renderCard();

    expect(screen.queryByText(/↳ re/u)).toBeNull();
  });

  it('names who boosted the post above the author, with their avatar', () => {
    const { view } = renderCard({
      boostedBy: { handle: 'bob', fullHandle: '@bob@m.example', avatar: AVATAR },
    });

    expect(view.container.textContent).toContain('⟳ <bob> boosted');
    expect(screen.getByRole('img', { name: 'Avatar of @bob@m.example' })).toBeInTheDocument();
  });

  it('leaves an unboosted post without a boost line', () => {
    const { view } = renderCard();

    expect(view.container.textContent).not.toContain('boosted');
  });

  it('shows the audience glyph and the tallies after the body', () => {
    const { view } = renderCard({
      visibility: 'direct',
      counts: { replies: 2, boosts: 1, favourites: 5 },
      edited: true,
    });

    expect(screen.getByTitle('direct')).toBeInTheDocument();
    expect(view.container.textContent).toContain('↩2 ⟳1 ★5');
    expect(view.container.textContent).toContain('(edited)');
  });

  it('toggles the warning from its button, which the card click leaves alone', () => {
    const { onToggleReveal, onSelect } = renderCard({ spoilerText: 'spoilers' });

    fireEvent.click(screen.getByRole('button', { name: '[CW: spoilers]' }));

    expect(onToggleReveal).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('draws the quoted post, the poll and the attachments', () => {
    renderCard({
      quote: {
        label: 'a4',
        author: { handle: 'bob', fullHandle: '@bob@m.example' },
        excerpt: 'the wired is all one network.',
      },
      poll: {
        options: [
          { title: 'yes', votes: 3 },
          { title: 'no', votes: 7 },
        ],
        totalVotes: 10,
        expiresAt: new Date(2026, 0, 2, 23, 59),
        expired: false,
        multiple: false,
        ownVotes: [0],
        voted: true,
      },
      media: [
        {
          id: 'm1',
          type: 'image',
          url: 'https://m.example/media/full.png',
          previewUrl: 'https://m.example/media/small.png',
          description: 'a wall',
        },
      ],
    });

    expect(screen.getByText(/the wired is all one network\./u)).toBeInTheDocument();
    expect(screen.getByText(/10 votes/u)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'a wall' })).toBeInTheDocument();
  });

  it('shows the author avatar, as the still image, when showAvatar is on', () => {
    renderCard();

    expect(screen.getByRole('img', { name: 'Avatar of @alice@m.example' })).toHaveAttribute(
      'src',
      AVATAR.staticSrc,
    );
  });

  it('shows no avatar when showAvatar is off', () => {
    renderCard({
      showAvatar: false,
      boostedBy: { handle: 'bob', fullHandle: '@bob@m.example', avatar: AVATAR },
    });

    expect(screen.queryByRole('img')).toBeNull();
  });

  it('marks the selected card with aria-current', () => {
    renderCard({ selected: true });

    expect(screen.getByRole('article')).toHaveAttribute('aria-current', 'true');
  });

  it('leaves an unselected card without aria-current', () => {
    renderCard();

    expect(screen.getByRole('article')).not.toHaveAttribute('aria-current');
  });

  it('selects the card when its text is clicked', () => {
    const { onSelect } = renderCard();

    fireEvent.click(screen.getByText('[a3]'));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('opens the author when the nick is clicked, without selecting', () => {
    const { onSelect, onSelectAuthor } = renderCard();

    fireEvent.click(screen.getByRole('button', { name: '@alice@m.example' }));

    expect(onSelectAuthor).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('hands a clicked body link to the app and keeps the browser away', () => {
    const onContentLink = vi.fn<(href: string) => boolean>(() => true);
    const { onSelect } = renderCard({
      contentHtml: '<p><a href="https://wired.example/tags/rust">#rust</a></p>',
      onContentLink,
    });

    const proceeded = fireEvent.click(screen.getByRole('link', { name: '#rust' }));

    expect(onContentLink).toHaveBeenCalledExactlyOnceWith('https://wired.example/tags/rust');
    expect(proceeded).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
