/**
 * Tests for Avatar: the alt text, the animated and still sources chosen by the
 * animate prop, the still forced by prefers-reduced-motion (with matchMedia
 * mocked, and followed live), the default image on a load error exactly once,
 * and the default for an account with no picture.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Avatar } from './Avatar';
import type { AvatarProps } from './Avatar';

const ANIMATED = 'https://m.example/avatars/alice.gif';
const STILL = 'https://m.example/avatars/alice.png';

/** Render an avatar with {@link overrides} over an animating one. */
function renderAvatar(overrides: Partial<AvatarProps> = {}) {
  return render(
    <Avatar
      src={ANIMATED}
      staticSrc={STILL}
      handle="@alice@m.example"
      size="small"
      animate
      {...overrides}
    />,
  );
}

/** The listeners a mocked media query has been given. */
type Listeners = Set<() => void>;

/** Mock matchMedia to answer {@link matches}; returns the live listener set and a setter. */
function mockMatchMedia(matches: boolean): { listeners: Listeners; set: (next: boolean) => void } {
  const listeners: Listeners = new Set();
  let current = matches;
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return current;
    },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }));
  return {
    listeners,
    set: (next) => {
      current = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
}

describe(Avatar, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('names the account in its alt text', () => {
    renderAvatar();

    expect(screen.getByRole('img', { name: 'Avatar of @alice@m.example' })).toBeInTheDocument();
  });

  it('shows the animated image when animation is on', () => {
    renderAvatar();

    expect(screen.getByRole('img')).toHaveAttribute('src', ANIMATED);
  });

  it('shows the still image when animation is off', () => {
    renderAvatar({ animate: false });

    expect(screen.getByRole('img')).toHaveAttribute('src', STILL);
  });

  it('loads lazily without leaking a referrer', () => {
    renderAvatar({ size: 'medium' });

    expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy');
    expect(screen.getByRole('img')).toHaveAttribute('decoding', 'async');
    expect(screen.getByRole('img')).toHaveAttribute('referrerpolicy', 'no-referrer');
  });

  it('forces the still image under prefers-reduced-motion', () => {
    mockMatchMedia(true);
    renderAvatar();

    expect(screen.getByRole('img')).toHaveAttribute('src', STILL);
  });

  it('keeps animating when reduced motion is not asked for', () => {
    mockMatchMedia(false);
    renderAvatar();

    expect(screen.getByRole('img')).toHaveAttribute('src', ANIMATED);
  });

  it('follows the preference as it changes and stops listening on unmount', () => {
    const media = mockMatchMedia(false);
    const { unmount } = renderAvatar();

    act(() => {
      media.set(true);
    });

    expect(screen.getByRole('img')).toHaveAttribute('src', STILL);

    unmount();

    expect(media.listeners.size).toBe(0);
  });

  it('falls back to the default image once when loading fails', () => {
    renderAvatar();

    fireEvent.error(screen.getByRole('img'));

    expect(screen.getByRole('img')).toHaveAttribute('src', 'images/avi.png');

    fireEvent.error(screen.getByRole('img'));

    expect(screen.getByRole('img')).toHaveAttribute('src', 'images/avi.png');
  });

  it('tries a new picture again after an earlier one failed', () => {
    const { rerender } = renderAvatar();

    fireEvent.error(screen.getByRole('img'));

    rerender(
      <Avatar src={STILL} staticSrc={STILL} handle="@alice@m.example" size="small" animate />,
    );

    expect(screen.getByRole('img')).toHaveAttribute('src', STILL);
  });

  it('shows the default image for an account with no picture', () => {
    renderAvatar({ src: '', staticSrc: '' });

    expect(screen.getByRole('img')).toHaveAttribute('src', 'images/avi.png');
  });
});
