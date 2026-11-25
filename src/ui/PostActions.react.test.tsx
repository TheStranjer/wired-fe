/**
 * Tests for the card's `☺` button (WFE-265): where the registry's react line
 * opens the picker a click opens the emoji picker and hands no line on, a
 * choice is reported with whether it takes the viewer's reaction back, the
 * picker closes and gives focus back to the button, and a line that only
 * prefills is still handed on.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PostActions } from './PostActions';
import type { PostActionsProps } from './PostActions';
import type { PostActionLine, ReactPicker } from './postActionTypes';

const PICKER_LINE: PostActionLine = { line: '/react a3', prefill: false, picker: true };

/** What the bar's callbacks were called with. */
type Spies = {
  readonly onAction: (line: PostActionLine) => void;
  readonly onOpen: () => void;
  readonly onChoose: (emoji: string, remove: boolean) => void;
};

/** Render the bar with `/react` opening the picker, over two Unicode emoji and one reaction. */
function renderBar(overrides: Partial<PostActionsProps> = {}): Spies {
  const spies: Spies = {
    onAction: vi.fn<(line: PostActionLine) => void>(),
    onOpen: vi.fn<() => void>(),
    onChoose: vi.fn<(emoji: string, remove: boolean) => void>(),
  };
  const picker: ReactPicker = {
    data: {
      custom: [],
      unicode: [
        { emoji: '🔥', name: 'fire', group: 'objects', keywords: ['flame'] },
        { emoji: '😀', name: 'grinning face', group: 'smileys', keywords: [] },
      ],
    },
    onOpen: spies.onOpen,
    onChoose: spies.onChoose,
  };
  render(
    <PostActions
      counts={{ replies: 0, boosts: 0, favourites: 0 }}
      label="a3"
      lines={{ react: PICKER_LINE }}
      mine={{ boosted: false, favourited: false, bookmarked: false }}
      onAction={spies.onAction}
      own={false}
      picker={picker}
      reactions={[{ name: '😀', count: 1, me: true, url: null }]}
      {...overrides}
    />,
  );
  return spies;
}

/** The `☺` button. */
function reactButton(): HTMLElement {
  return screen.getByRole('button', { name: 'React to post a3' });
}

describe('the react button', () => {
  it('opens the emoji picker instead of handing the line on', () => {
    const spies = renderBar();

    fireEvent.click(reactButton());

    expect(screen.getByRole('dialog', { name: 'React to [a3]' })).toBeVisible();
    expect(spies.onOpen).toHaveBeenCalledExactlyOnceWith();
    expect(spies.onAction).not.toHaveBeenCalled();
    expect(reactButton()).toHaveAttribute('aria-expanded', 'true');
    expect(reactButton()).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('closes the picker when pressed again', () => {
    renderBar();

    fireEvent.click(reactButton());
    fireEvent.click(reactButton());

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(reactButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('reports a choice, closes the picker and returns focus to the button', () => {
    const spies = renderBar();
    fireEvent.click(reactButton());

    fireEvent.click(screen.getByRole('button', { name: 'fire' }));

    expect(spies.onChoose).toHaveBeenCalledExactlyOnceWith('🔥', false);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(reactButton()).toHaveFocus();
    expect(spies.onAction).not.toHaveBeenCalled();
  });

  it('reports choosing a reaction of your own as taking it back', () => {
    const spies = renderBar();
    fireEvent.click(reactButton());

    fireEvent.click(screen.getByRole('button', { name: '😀', pressed: true }));

    expect(spies.onChoose).toHaveBeenCalledExactlyOnceWith('😀', true);
  });

  it('closes on Escape and returns focus to the button', () => {
    renderBar();
    fireEvent.click(reactButton());

    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(reactButton()).toHaveFocus();
  });

  it('closes on a click outside the picker', () => {
    renderBar();
    fireEvent.click(reactButton());

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stays open on a click inside the picker', () => {
    renderBar();
    fireEvent.click(reactButton());

    fireEvent.mouseDown(screen.getByRole('searchbox'));

    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('hands a line that only prefills on, with no picker', () => {
    const line: PostActionLine = { line: '/react a3', prefill: true };
    const spies = renderBar({ lines: { react: line } });

    fireEvent.click(reactButton());

    expect(spies.onAction).toHaveBeenCalledExactlyOnceWith(line);
    expect(spies.onOpen).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(reactButton()).not.toHaveAttribute('aria-expanded');
    expect(reactButton()).not.toHaveAttribute('aria-haspopup');
  });

  it('has no button without a react line', () => {
    renderBar({ lines: {} });

    expect(screen.queryByRole('button', { name: 'React to post a3' })).toBeNull();
  });
});
