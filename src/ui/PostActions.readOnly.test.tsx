/**
 * Tests for the action bar of a signed-out card (WFE-340): every button —
 * reply, boost, favourite, react, bookmark and `⋯` — is `aria-disabled`,
 * keeps its accessible name and carries a description saying to sign in; a
 * press still hands its line on (so the command's refusal answers it), the
 * react button opens no picker and `⋯` opens no menu.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { type Mock, describe, expect, it, vi } from 'vitest';

import { PostActions } from './PostActions';
import type { PostActionsProps } from './PostActions';
import type { PostActionLine, PostActionLines } from './postActionTypes';

const NOTE = 'Sign in to use this action';

/** The names of the six buttons. */
const NAMES = [
  'Reply to post a3',
  'Boost post a3',
  'Favourite post a3',
  'React to post a3',
  'Bookmark post a3',
  'More actions for post a3',
];

const LINES: PostActionLines = {
  reply: { line: '/reply a3', prefill: false },
  boost: { line: '/boost a3', prefill: false },
  fav: { line: '/fav a3', prefill: false },
  react: { line: '/react a3', prefill: false, picker: true },
  bookmark: { line: '/bookmark a3', prefill: false },
  quote: { line: '/quote a3', prefill: false },
  copy: { line: '/copy a3', prefill: false },
};

const BASE: PostActionsProps = {
  label: 'a3',
  counts: { replies: 0, boosts: 0, favourites: 0 },
  mine: { boosted: false, favourited: false, bookmarked: false },
  own: false,
  lines: LINES,
  onAction: () => undefined,
  reactions: [],
  picker: { data: { custom: [], unicode: [] }, onOpen: () => undefined, onChoose: () => undefined },
  readOnly: true,
};

/** Render the signed-out bar with overrides; returns the spy the pressed lines go to. */
function renderBar(
  overrides: Partial<PostActionsProps> = {},
): Mock<(line: PostActionLine) => void> {
  const onAction = vi.fn<(line: PostActionLine) => void>();
  render(<PostActions {...BASE} {...overrides} onAction={onAction} />);
  return onAction;
}

describe('the action bar of a signed-out card', () => {
  it.each(NAMES)('disables %s, keeps its name and says to sign in', (name) => {
    renderBar();

    const button = screen.getByRole('button', { name });

    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-description', NOTE);
  });

  it('hands the line of a pressed button on, so the command refuses', () => {
    const onAction = renderBar();

    fireEvent.click(screen.getByRole('button', { name: 'Favourite post a3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reply to post a3' }));

    expect(onAction.mock.calls.map(([line]) => line.line)).toStrictEqual(['/fav a3', '/reply a3']);
  });

  it('hands the react line on instead of opening the picker', () => {
    const onAction = renderBar();

    fireEvent.click(screen.getByRole('button', { name: 'React to post a3' }));

    expect(onAction).toHaveBeenCalledWith(LINES['react']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hands the quote line on from ⋯ and opens no menu', () => {
    const onAction = renderBar();

    fireEvent.click(screen.getByRole('button', { name: 'More actions for post a3' }));

    expect(onAction).toHaveBeenCalledWith(LINES['quote']);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('hands nothing on from ⋯ when there is no quote line', () => {
    const lines = Object.fromEntries(Object.entries(LINES).filter(([key]) => key !== 'quote'));
    const onAction = renderBar({ lines });

    fireEvent.click(screen.getByRole('button', { name: 'More actions for post a3' }));

    expect(onAction).not.toHaveBeenCalled();
  });
});

describe('the action bar of an ordinary card', () => {
  it('is not disabled and has no sign-in note', () => {
    renderBar({ readOnly: undefined });

    const button = screen.getByRole('button', { name: 'Favourite post a3' });

    expect(button).not.toHaveAttribute('aria-disabled');
    expect(button).not.toHaveAttribute('aria-description');
  });
});
