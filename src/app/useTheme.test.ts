/**
 * Tests for useTheme: the hook mirrors the theme setting onto the document
 * root — a chosen theme names itself in `data-theme`, the default `wired`
 * leaves no attribute (the bare `:root` of tokens.css already paints it), and
 * switching repaints: lain over bnet, wired clears what a theme left behind.
 */
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useTheme } from './useTheme';
import type { Theme } from '../state/settings';

/** The document root's theme attribute as it stands. */
function themeAttribute(): string | undefined {
  return document.documentElement.dataset['theme'];
}

describe(useTheme, () => {
  afterEach(() => {
    delete document.documentElement.dataset['theme'];
  });

  it('names a chosen theme on the root element', () => {
    renderHook(() => {
      useTheme('lain');
    });

    expect(themeAttribute()).toBe('lain');
  });

  it('sets no attribute for the default wired theme', () => {
    renderHook(() => {
      useTheme('wired');
    });

    expect(themeAttribute()).toBeUndefined();
  });

  it('follows the reader switching themes, removing it for wired', () => {
    const { rerender } = renderHook(
      ({ theme }: { theme: Theme }) => {
        useTheme(theme);
      },
      { initialProps: { theme: 'bnet' } },
    );

    expect(themeAttribute()).toBe('bnet');

    rerender({ theme: 'lain' });

    expect(themeAttribute()).toBe('lain');

    rerender({ theme: 'wired' });

    expect(themeAttribute()).toBeUndefined();
  });

  it('clears a theme a previous session left on the bare document', () => {
    document.documentElement.dataset['theme'] = 'lain';

    renderHook(() => {
      useTheme('wired');
    });

    expect(themeAttribute()).toBeUndefined();
  });
});
