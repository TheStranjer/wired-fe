/**
 * Tests for useTheme: the hook mirrors the theme and effects settings onto the
 * document root — a chosen theme names itself in `data-theme`, the default
 * `wired` leaves no attribute (the bare `:root` of tokens.css already paints
 * it), switching repaints, and `effects` toggles `data-effects='on'` for
 * effects.css on and off. Effects stay off unless the setting says otherwise.
 */
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useTheme } from './useTheme';
import type { Theme } from '../state/settings';

/** The document root's theme attribute as it stands. */
function themeAttribute(): string | undefined {
  return document.documentElement.dataset['theme'];
}

/** The document root's effects attribute as it stands. */
function effectsAttribute(): string | undefined {
  return document.documentElement.dataset['effects'];
}

describe(useTheme, () => {
  afterEach(() => {
    delete document.documentElement.dataset['theme'];
    delete document.documentElement.dataset['effects'];
  });

  it('names a chosen theme on the root element', () => {
    renderHook(() => {
      useTheme('lain', false);
    });

    expect(themeAttribute()).toBe('lain');
  });

  it('sets no attribute for the default wired theme', () => {
    renderHook(() => {
      useTheme('wired', false);
    });

    expect(themeAttribute()).toBeUndefined();
  });

  it('follows the reader switching themes, removing it for wired', () => {
    const { rerender } = renderHook(
      ({ theme }: { theme: Theme }) => {
        useTheme(theme, false);
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
      useTheme('wired', false);
    });

    expect(themeAttribute()).toBeUndefined();
  });

  it('switches the effects on with the setting', () => {
    renderHook(() => {
      useTheme('wired', true);
    });

    expect(effectsAttribute()).toBe('on');
  });

  it('sets no effects attribute while the setting stays off', () => {
    renderHook(() => {
      useTheme('wired', false);
    });

    expect(effectsAttribute()).toBeUndefined();
  });

  it('follows the reader turning effects off and on again', () => {
    const { rerender } = renderHook(
      ({ effects }: { effects: boolean }) => {
        useTheme('lain', effects);
      },
      { initialProps: { effects: true } },
    );

    expect(effectsAttribute()).toBe('on');

    rerender({ effects: false });

    expect(effectsAttribute()).toBeUndefined();

    rerender({ effects: true });

    expect(effectsAttribute()).toBe('on');
  });

  it('clears effects a previous session left on the bare document', () => {
    document.documentElement.dataset['effects'] = 'on';

    renderHook(() => {
      useTheme('wired', false);
    });

    expect(effectsAttribute()).toBeUndefined();
  });
});
