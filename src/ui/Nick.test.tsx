/**
 * Tests for the nick: the bracketed text, the aria-hidden brackets, the
 * clickable versus plain rendering, accessible name, title and clicks.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Nick } from './Nick';
import type { NickProps } from './Nick';
import type { ClickModifiers } from '../lib/clickModifiers';

const BASE_PROPS: NickProps = {
  handle: 'alice',
  fullHandle: '@alice@m.example',
  self: false,
};

describe(Nick, () => {
  it('renders the handle between angle brackets', () => {
    const { container } = render(<Nick {...BASE_PROPS} />);

    expect(container.textContent).toBe('<alice>');
  });

  it('hides both brackets from assistive technology', () => {
    const { container } = render(<Nick {...BASE_PROPS} />);

    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });

  it('turns the handle into a labelled button when onSelect is given', () => {
    render(<Nick {...BASE_PROPS} onSelect={vi.fn<() => void>()} />);

    expect(screen.getByRole('button', { name: '@alice@m.example' })).toHaveAttribute(
      'title',
      '@alice@m.example',
    );
  });

  it('calls onSelect when the handle button is clicked', () => {
    const onSelect = vi.fn<() => void>();
    render(<Nick {...BASE_PROPS} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: '@alice@m.example' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('passes the click with its modifiers to onSelect', () => {
    const onSelect = vi.fn<(click: ClickModifiers) => void>();
    render(<Nick {...BASE_PROPS} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: '@alice@m.example' }), { shiftKey: true });

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ shiftKey: true }));
  });

  it('calls onSelect for a middle click, which the browser reports as an auxiliary click', () => {
    const onSelect = vi.fn<(click: ClickModifiers) => void>();
    render(<Nick {...BASE_PROPS} onSelect={onSelect} />);

    fireEvent(
      screen.getByRole('button', { name: '@alice@m.example' }),
      new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }),
    );

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ button: 1 }));
  });

  it('renders plain text without onSelect', () => {
    render(<Nick {...BASE_PROPS} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('alice')).toHaveAttribute('title', '@alice@m.example');
  });

  it('still renders the bracketed handle as a button for oneself', () => {
    const { container } = render(<Nick {...BASE_PROPS} self onSelect={vi.fn<() => void>()} />);

    expect(container.textContent).toBe('<alice>');
    expect(screen.getByRole('button', { name: '@alice@m.example' })).toBeInTheDocument();
  });

  it('renders the same bracketed text and title when told to truncate', () => {
    const { container } = render(<Nick {...BASE_PROPS} truncate />);

    expect(container.textContent).toBe('<alice>');
    expect(screen.getByText('alice')).toHaveAttribute('title', '@alice@m.example');
  });
});
