/**
 * Tests for the post metadata suffix: silence about a plain public post, each
 * audience glyph with its title and its hidden words, the three counters only
 * above zero, the viewer's own marks and the words that stand in for their
 * colour, the reactions, the edit mark, and the whole suffix in reading order.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PostMeta } from './PostMeta';
import type { PostMetaProps } from './PostMeta';

/** A post nobody has answered, boosted, favourited, reacted to or restricted. */
const NOTHING: PostMetaProps = {
  visibility: 'public',
  counts: { replies: 0, boosts: 0, favourites: 0 },
  mine: { boosted: false, favourited: false, bookmarked: false },
  reactions: [],
  edited: false,
};

/** Render the suffix with {@link overrides} over the all-quiet default. */
function renderMeta(overrides: Partial<PostMetaProps> = {}) {
  return render(<PostMeta {...NOTHING} {...overrides} />);
}

const SOME_COUNTS = { replies: 2, boosts: 1, favourites: 5 };
const NONE_DONE = { boosted: false, favourited: false, bookmarked: false };

/** Each audience that is not the whole wired: how it shows, and what it says. */
const AUDIENCES: readonly (readonly [PostMetaProps['visibility'], string, string])[] = [
  ['unlisted', '~', 'unlisted'],
  ['private', '🔒', 'followers only'],
  ['direct', '✉', 'direct'],
  ['local', '◌', 'local only'],
];

describe(PostMeta, () => {
  it('says nothing at all about a plain public post', () => {
    const { container } = renderMeta();

    expect(container.textContent).toBe('');
  });

  it.each(AUDIENCES)('marks %s posts with %s and the words %s', (visibility, glyph, label) => {
    renderMeta({ visibility });

    expect(screen.getByTitle(label)).toHaveTextContent(glyph);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('announces the audience in words and hides the glyph from screen readers', () => {
    renderMeta({ visibility: 'private' });

    expect(screen.getByText('followers only')).not.toHaveAttribute('aria-hidden');
    expect(screen.getByText('🔒')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows each counter with its glyph, and only the ones above zero', () => {
    const { container } = renderMeta({ counts: { replies: 2, boosts: 1, favourites: 0 } });

    expect(container.textContent).toBe('  ↩2 ⟳1');
    expect(screen.queryByText('★0')).toBeNull();
  });

  it('counts replies, boosts and favourites in that order', () => {
    const { container } = renderMeta({ counts: SOME_COUNTS });

    expect(container.textContent).toBe('  ↩2 ⟳1 ★5');
  });

  it('says which tallies the viewer has already joined', () => {
    renderMeta({
      counts: SOME_COUNTS,
      mine: { boosted: true, favourited: false, bookmarked: true },
    });

    expect(screen.getByText('⟳1')).toHaveAttribute('title', 'you boosted this');
    expect(screen.getByText('🔖')).toHaveAttribute('title', 'you bookmarked this');
    expect(screen.getByText('★5')).not.toHaveAttribute('title');
  });

  it('labels no tally when the viewer has done none of it', () => {
    const { container } = renderMeta({ counts: SOME_COUNTS, mine: NONE_DONE });

    expect(container.textContent).toBe('  ↩2 ⟳1 ★5');
    expect(container.querySelector('[title]')).toBeNull();
  });

  it('shows each reaction as its emoji and tally', () => {
    const { container } = renderMeta({
      reactions: [
        { name: '🔥', count: 2, me: true },
        { name: '❤️', count: 1, me: false },
      ],
    });

    expect(container.textContent).toBe('  🔥2 ❤️1');
    expect(screen.getByText('🔥2')).toHaveAttribute('title', 'you reacted with 🔥');
    expect(screen.getByText('❤️1')).not.toHaveAttribute('title');
  });

  it('marks a post the author edited', () => {
    const { container } = renderMeta({ edited: true });

    expect(screen.getByText('(edited)')).toBeInTheDocument();
    expect(container.textContent).toBe('  (edited)');
  });

  it('reads the whole suffix in order: audience, tallies, reactions, edit', () => {
    const { container } = renderMeta({
      visibility: 'direct',
      counts: SOME_COUNTS,
      mine: { boosted: true, favourited: false, bookmarked: false },
      reactions: [{ name: '🔥', count: 2, me: false }],
      edited: true,
    });

    expect(container.textContent).toBe(' direct✉  ↩2 ⟳1 ★5 🔥2 (edited)');
  });
});
