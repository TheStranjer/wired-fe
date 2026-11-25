/**
 * Tests for the post card: header parts, boost line, body and CW toggle,
 * quote, poll and media, avatars, selected marking, and click routing.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PostCard } from './PostCard';
import { AVATAR, BASE_PROPS, renderCard } from './postCardHarness';

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
