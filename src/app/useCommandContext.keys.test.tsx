/**
 * Tests for the key-binding helpers the app context carries (WFE-130): the
 * real chord parser and insert-mode guard from src/keys, and the effective
 * bindings — the shipped registry's defaults flattened, with the reader's
 * stored overrides replacing, adding to and deleting from them.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useCommandContext } from './useCommandContext';
import type { CommandContext } from '../commands/types';
import type { AppAction } from '../state/reducer';
import { seeded } from '../test/appSessions';
import { fakeAttachments } from '../test/commandContext';

/** Renders the context hook over a session built from {@link actions}. */
function renderContext(actions: readonly AppAction[]): CommandContext {
  const { result } = renderHook(
    () => useCommandContext(vi.fn(), () => undefined, fakeAttachments()),
    { wrapper: seeded(actions) },
  );
  return result.current;
}

describe('the context’s key-binding helpers', () => {
  it('hands commands the real chord parser and typing guard', () => {
    const context = renderContext([]);

    expect(context.keys.parseChord('ctrl+e')).toBe('Ctrl+e');
    expect(context.keys.parseChord('banana+')).toBeNull();
    expect(context.keys.blocksTyping('a')).toBe(true);
    expect(context.keys.blocksTyping('Alt+3')).toBe(false);
  });

  it('hands commands the shipped registry’s defaults as one keymap', () => {
    const { keymap } = renderContext([]).keys;

    expect(keymap.insert.get('Alt+3')).toStrictEqual({ line: '/win 3', prefill: false });
    expect(keymap.navigation.get('r')).toStrictEqual({
      line: '/reply {label}',
      prefill: true,
    });
  });

  it('lays the reader’s overrides over the defaults', () => {
    const rebound: AppAction = {
      type: 'settings',
      settings: {
        keyOverrides: [
          { mode: 'navigation', chord: 'r', line: '/reply 9' },
          { mode: 'navigation', chord: 'f', line: null },
          { mode: 'navigation', chord: 'Ctrl+e', line: '/about' },
        ],
      },
    };
    const { keymap } = renderContext([rebound]).keys;

    expect(keymap.navigation.get('r')).toStrictEqual({ line: '/reply 9', prefill: false });
    expect(keymap.navigation.get('f')).toBeUndefined();
    expect(keymap.navigation.get('Ctrl+e')).toStrictEqual({ line: '/about', prefill: false });
  });
});
