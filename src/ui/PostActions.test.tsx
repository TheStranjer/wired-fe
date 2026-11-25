/**
 * Tests for the card's action bar: each button hands on the line of its
 * command, the toggles show the viewer's own marks with aria-pressed and hand
 * on the undo line when pressed again, a command without a line has no button,
 * and the more-menu offers different rows for your own post and another's.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PostActions } from './PostActions';
import type { PostActionsProps } from './PostActions';
import type { PostActionLine, PostActionLines } from './postActionTypes';

/** Every command a card can run, as the registry would hand its lines for a3. */
const ALL_LINES: PostActionLines = Object.fromEntries(
  [
    'reply',
    'boost',
    'unboost',
    'fav',
    'unfav',
    'react',
    'bookmark',
    'unbookmark',
    'quote',
    'copy',
    'open',
    'thread',
    'pin',
    'unpin',
    'edit',
    'delete',
    'mute',
    'block',
  ].map((name) => [
    name,
    { line: `/${name} a3`, prefill: ['reply', 'react', 'mute'].includes(name) },
  ]),
);

const BASE_PROPS: PostActionsProps = {
  label: 'a3',
  counts: { replies: 0, boosts: 0, favourites: 0 },
  mine: { boosted: false, favourited: false, bookmarked: false },
  own: false,
  lines: ALL_LINES,
  onAction: () => undefined,
};

/** Render the bar with overrides; returns the spy the pressed lines go to. */
function renderBar(overrides: Partial<PostActionsProps> = {}): (line: PostActionLine) => void {
  const onAction = vi.fn<(line: PostActionLine) => void>();
  render(<PostActions {...BASE_PROPS} {...overrides} onAction={onAction} />);
  return onAction;
}

/** {@link ALL_LINES} without the command called {@link name}. */
function without(name: string): PostActionLines {
  return Object.fromEntries(Object.entries(ALL_LINES).filter(([key]) => key !== name));
}

/** The names of the menu rows after opening the more-menu. */
function menuRows(): readonly (string | null)[] {
  fireEvent.click(screen.getByRole('button', { name: 'More actions for post a3' }));
  return screen.getAllByRole('menuitem').map((row) => row.textContent);
}

describe(PostActions, () => {
  it('is a group named by the post', () => {
    renderBar();

    expect(screen.getByRole('group', { name: 'Actions for post a3' })).toBeVisible();
  });

  it('shows the glyphs, the tallies after them', () => {
    renderBar({ counts: { replies: 2, boosts: 1, favourites: 5 } });

    expect(screen.getByRole('button', { name: 'Reply to post a3 (2 replies)' })).toHaveTextContent(
      '↩ 2',
    );
    expect(screen.getByRole('button', { name: 'Boost post a3' })).toHaveTextContent('⟳ 1');
    expect(screen.getByRole('button', { name: 'Favourite post a3' })).toHaveTextContent('★ 5');
    expect(screen.getByRole('button', { name: 'React to post a3' })).toHaveTextContent('☺');
    expect(screen.getByRole('button', { name: 'Bookmark post a3' })).toHaveTextContent('🔖');
  });

  it('names the tallies in the title and the singular reply in its name', () => {
    renderBar({ counts: { replies: 1, boosts: 1, favourites: 3 } });

    expect(screen.getByRole('button', { name: 'Reply to post a3 (1 reply)' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Boost post a3' })).toHaveAttribute(
      'title',
      '1 boost',
    );
    expect(screen.getByRole('button', { name: 'Favourite post a3' })).toHaveAttribute(
      'title',
      '3 favourites',
    );
  });

  it('shows no tally for a post nobody has answered, boosted or favourited', () => {
    renderBar();

    expect(screen.getByRole('button', { name: 'Reply to post a3' })).toHaveTextContent(/^↩$/u);
    expect(screen.getByRole('button', { name: 'Boost post a3' })).not.toHaveAttribute('title');
  });

  it.each([
    ['Reply to post a3', { line: '/reply a3', prefill: true }],
    ['Boost post a3', { line: '/boost a3', prefill: false }],
    ['Favourite post a3', { line: '/fav a3', prefill: false }],
    ['React to post a3', { line: '/react a3', prefill: true }],
    ['Bookmark post a3', { line: '/bookmark a3', prefill: false }],
  ])('hands on the line of %s', (name, line) => {
    const onAction = renderBar();

    fireEvent.click(screen.getByRole('button', { name }));

    expect(onAction).toHaveBeenCalledExactlyOnceWith(line);
  });

  it('marks the toggles unpressed when the viewer has done nothing', () => {
    renderBar();

    expect(screen.getByRole('button', { name: 'Boost post a3' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Reply to post a3' })).not.toHaveAttribute(
      'aria-pressed',
    );
  });

  it.each([
    ['Boost post a3', { boosted: true, favourited: false, bookmarked: false }, '/unboost a3'],
    ['Favourite post a3', { boosted: false, favourited: true, bookmarked: false }, '/unfav a3'],
    ['Bookmark post a3', { boosted: false, favourited: false, bookmarked: true }, '/unbookmark a3'],
  ])('shows %s pressed and runs the undo line', (name, mine, line) => {
    const onAction = renderBar({ mine });
    const button = screen.getByRole('button', { name });

    expect(button).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(button);

    expect(onAction).toHaveBeenCalledExactlyOnceWith({ line, prefill: false });
  });

  it('leaves out the button of a command the backend cannot do', () => {
    renderBar({ lines: without('react') });

    expect(screen.queryByRole('button', { name: 'React to post a3' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reply to post a3' })).toBeVisible();
  });

  it('draws no buttons and no menu when no command has a line', () => {
    renderBar({ lines: {} });

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers another author’s post the shared rows, mute and block', () => {
    renderBar({ own: false });

    expect(menuRows()).toStrictEqual([
      'Quote',
      'Copy link',
      'Open in browser',
      'Open thread',
      'Mute author',
      'Block author',
    ]);
  });

  it('offers your own post the shared rows, pin, unpin, edit and delete', () => {
    renderBar({ own: true });

    expect(menuRows()).toStrictEqual([
      'Quote',
      'Copy link',
      'Open in browser',
      'Open thread',
      'Pin',
      'Unpin',
      'Edit',
      'Delete',
    ]);
  });

  it('drops the menu rows of commands without a line', () => {
    renderBar({ lines: without('quote') });

    expect(menuRows()).not.toContain('Quote');
  });

  it('hands on the line of the chosen menu row', () => {
    const onAction = renderBar({ own: true });
    menuRows();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(onAction).toHaveBeenCalledExactlyOnceWith({ line: '/delete a3', prefill: false });
  });

  it('prefills the mute row, as its hotkey does', () => {
    const onAction = renderBar();
    menuRows();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Mute author' }));

    expect(onAction).toHaveBeenCalledExactlyOnceWith({ line: '/mute a3', prefill: true });
  });
});
