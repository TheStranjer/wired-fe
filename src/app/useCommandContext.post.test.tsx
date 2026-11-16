/**
 * How a post reaches the window kind that does answer: the context looks the
 * active window's kind up and calls its `onPost` with the draft, the window and
 * a post context, and hands back whatever that handler said. The shipped bundle
 * has no such kind yet, so these kinds are a test double.
 */
import { renderHook } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCommandContext } from './useCommandContext';
import type { CommandContext } from '../commands/types';
import { initialAppState } from '../state/appState';
import { type AppAction, appReducer } from '../state/reducer';
import { AppStateProvider } from '../state/StateContext';
import type { WindowKindDefinition } from '../state/windowKind';
import { windowId } from '../windows/model';
import type { WindowKind, WindowRef } from '../windows/model';

/** A window of the kind whose post handler records what it was asked for. */
const HOME: WindowRef = { kind: 'home', accountKey: null, target: null };

/** A window of the kind whose post handler answers with {@link REFUSAL}. */
const THREAD: WindowRef = { kind: 'thread', accountKey: null, target: 'a3' };

/** What the fake thread kind says when asked to post. */
const REFUSAL = 'Nothing to reply to';

/** The fake kinds and what the home one was asked to post. */
const KIND_STUBS = vi.hoisted(() => {
  const posts: { text: string; windowId: string; ready: boolean }[] = [];
  const blank = (): null => null;
  const kinds = new Map<WindowKind, WindowKindDefinition>([
    [
      'home',
      {
        kind: 'home',
        topic: (): string => 'home',
        Component: blank,
        onPost: async (draft, window, postContext) => {
          posts.push({
            text: draft.text,
            windowId: window.id,
            ready: typeof postContext.dispatch === 'function' && postContext.now() instanceof Date,
          });
          return await Promise.resolve(null);
        },
      },
    ],
    [
      'thread',
      {
        kind: 'thread',
        topic: (): string => 'thread',
        Component: blank,
        onPost: async () => await Promise.resolve(REFUSAL),
      },
    ],
  ]);
  return { kinds, posts };
});

vi.mock(import('./windowKinds'), () => ({
  loadWindowKinds: () => ({ ok: true, value: KIND_STUBS.kinds }),
}));

/** The provider wrapper over a session whose active window is {@link ref}. */
function showing(ref: WindowRef) {
  const open: AppAction = { type: 'windows', action: { type: 'open', ref, title: ref.kind } };
  const initial = appReducer(initialAppState(), open);

  return function Wrapper({ children }: { readonly children: ReactNode }): JSX.Element {
    return <AppStateProvider initial={initial}>{children}</AppStateProvider>;
  };
}

/** The context of a session whose active window is the one {@link ref} names. */
function contextShowing(ref: WindowRef): CommandContext {
  const { result } = renderHook(() => useCommandContext(vi.fn(), vi.fn()), {
    wrapper: showing(ref),
  });

  return result.current;
}

describe('useCommandContext through a window kind that posts', () => {
  beforeEach(() => {
    KIND_STUBS.posts.length = 0;
  });

  it('calls the active kind with the draft, the window and a post context', async () => {
    const context = contextShowing(HOME);

    await expect(context.post({ text: 'hello lain' })).resolves.toBeNull();

    expect(KIND_STUBS.posts).toStrictEqual([
      { text: 'hello lain', windowId: windowId(HOME), ready: true },
    ]);
  });

  it('hands back what the active window kind answered', async () => {
    const context = contextShowing(THREAD);

    await expect(context.post({ text: 'hello' })).resolves.toBe(REFUSAL);
  });
});
