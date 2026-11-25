/**
 * Tests for the row body: a plain post renders as sanitized inline markup, a
 * warned post hides its content behind a collapsed `[CW:]` button, pressing
 * the button is asked of the owner, and once revealed the content follows it.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PostBody } from './PostBody';
import type { PostBodyProps } from './PostBody';

/** What the body shows in every test here but its own warning. */
const BASE: Omit<PostBodyProps, 'onToggleReveal'> = {
  contentHtml: '<p>present day, present time</p>',
  emojis: [],
  hasQuoteCard: false,
  spoilerText: '',
  revealed: false,
};

/** Render the body of {@link BASE} plus `overrides`, with a fresh toggle spy. */
function renderBody(overrides: Partial<Omit<PostBodyProps, 'onToggleReveal'>> = {}) {
  const onToggleReveal = vi.fn<() => void>();
  const view = render(<PostBody {...BASE} {...overrides} onToggleReveal={onToggleReveal} />);
  return { view, onToggleReveal };
}

describe(PostBody, () => {
  it('renders a plain post inline', () => {
    const { view } = renderBody();

    expect(view.container.textContent).toBe('present day, present time');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hides the content behind a collapsed warning button', () => {
    const { view } = renderBody({ spoilerText: 'lain spoilers' });

    const button = screen.getByRole('button', { name: '[CW: lain spoilers]' });

    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(view.container.textContent).toBe('[CW: lain spoilers]');
  });

  it('asks the owner when the button is pressed', () => {
    const { onToggleReveal } = renderBody({ spoilerText: 'spoilers' });

    fireEvent.click(screen.getByRole('button', { name: '[CW: spoilers]' }));

    expect(onToggleReveal).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the content after the button once revealed', () => {
    const { view } = renderBody({
      spoilerText: 'lain spoilers',
      contentHtml: '<p>the fourth wall</p>',
      revealed: true,
    });

    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    expect(view.container.textContent).toBe('[CW: lain spoilers] the fourth wall');
  });

  it('renders a custom emoji inside a revealed warning', () => {
    renderBody({
      spoilerText: 'lain spoilers',
      contentHtml: '<p>:cat: approved</p>',
      revealed: true,
      emojis: [{ shortcode: 'cat', url: 'https://example.org/cat.png' }],
    });

    expect(screen.getByRole('img', { name: ':cat:' })).toHaveAttribute(
      'src',
      'https://example.org/cat.png',
    );
  });
});
