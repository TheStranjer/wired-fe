/**
 * Tests for the post card's action bar and metadata (WFE-209): the tallies
 * live in the bar's buttons, the audience, reactions and edit mark stay above
 * it, a press hands the line on without selecting the card, and whose post
 * it is decides the more-menu.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { PostActionLine } from './postActionTypes';
import { BASE_PROPS, renderCard } from './postCardHarness';

describe('PostCard action bar', () => {
  it('shows the audience glyph and the edit mark after the body', () => {
    const { view } = renderCard({ visibility: 'direct', edited: true });

    expect(screen.getByTitle('direct')).toBeInTheDocument();
    expect(view.container.textContent).toContain('(edited)');
  });

  it('moves the tallies out of the metadata line and into the action bar', () => {
    const { view } = renderCard({
      counts: { replies: 2, boosts: 1, favourites: 5 },
      mine: { boosted: true, favourited: false, bookmarked: true },
      actionLines: {
        reply: { line: '/reply a3', prefill: true },
        boost: { line: '/boost a3', prefill: false },
        unboost: { line: '/unboost a3', prefill: false },
        fav: { line: '/fav a3', prefill: false },
      },
    });

    expect(view.container.textContent).not.toContain('↩2');
    expect(view.container.textContent).not.toContain('you boosted this');
    expect(screen.getByRole('button', { name: 'Reply to post a3 (2 replies)' })).toHaveAttribute(
      'data-count',
      '2',
    );
    expect(screen.getByRole('button', { name: 'Favourite post a3' })).toHaveAttribute(
      'data-count',
      '5',
    );
  });

  it('shows the reactions above the action bar', () => {
    renderCard({
      reactions: [{ name: '🔥', count: 2, me: false, url: null }],
      actionLines: { reply: { line: '/reply a3', prefill: true } },
    });

    const reaction = screen.getByRole('img', { name: '🔥, 2 reactions' });
    const bar = screen.getByRole('group', { name: 'Actions for post a3' });

    const following = reaction.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING;

    expect(following).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('hands an action-bar line to the app without selecting the card', () => {
    const onAction = vi.fn<(line: PostActionLine) => void>();
    const { onSelect } = renderCard({
      actionLines: { reply: { line: '/reply a3', prefill: true } },
      onAction,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reply to post a3' }));

    expect(onAction).toHaveBeenCalledExactlyOnceWith({ line: '/reply a3', prefill: true });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('offers the menu rows for your own post when the author is you', () => {
    renderCard({
      author: { ...BASE_PROPS.author, self: true },
      actionLines: { delete: { line: '/delete a3', prefill: false } },
    });

    fireEvent.click(screen.getByRole('button', { name: 'More actions for post a3' }));

    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
  });
});
