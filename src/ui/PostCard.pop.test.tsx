/**
 * Tests for the double-click that pops a post card out (WFE-241): a
 * double-click on the card's text asks `onPop` once; on a body link, the nick,
 * a button of the action bar or a content-warning toggle it does not.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderCard } from './postCardHarness';

describe('PostCard double-click', () => {
  it('pops the post when the card text is double-clicked', () => {
    const onPop = vi.fn<() => void>();
    renderCard({ onPop });

    fireEvent.doubleClick(screen.getByText('[a3]'));

    expect(onPop).toHaveBeenCalledTimes(1);
  });

  it('pops the post when the avatar is double-clicked', () => {
    const onPop = vi.fn<() => void>();
    renderCard({ onPop });

    fireEvent.doubleClick(screen.getByRole('img', { name: 'Avatar of @alice@m.example' }));

    expect(onPop).toHaveBeenCalledTimes(1);
  });

  it('does not pop for a double-click on a link in the body', () => {
    const onPop = vi.fn<() => void>();
    renderCard({
      onPop,
      contentHtml: '<p><a href="https://wired.example/tags/rust">#rust</a></p>',
    });

    fireEvent.doubleClick(screen.getByRole('link', { name: '#rust' }));

    expect(onPop).not.toHaveBeenCalled();
  });

  it('does not pop for a double-click on the nick', () => {
    const onPop = vi.fn<() => void>();
    renderCard({ onPop });

    fireEvent.doubleClick(screen.getByRole('button', { name: '@alice@m.example' }));

    expect(onPop).not.toHaveBeenCalled();
  });

  it('does not pop for a double-click on a content-warning toggle', () => {
    const onPop = vi.fn<() => void>();
    renderCard({ onPop, spoilerText: 'spoilers' });

    fireEvent.doubleClick(screen.getByRole('button', { name: '[CW: spoilers]' }));

    expect(onPop).not.toHaveBeenCalled();
  });
});
