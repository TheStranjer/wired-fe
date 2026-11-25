/**
 * Tests for the post-actions seam: a tree with no provider has no commands and
 * running a line does nothing; a provider's actions are what the hook returns.
 */
import { render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PostActionsProvider, usePostActions } from './PostActionsContext';
import type { PostActions } from './PostActionsContext';

describe(usePostActions, () => {
  it('has no commands and runs nothing without a provider', () => {
    const { result } = renderHook(() => usePostActions());

    expect(result.current.linesFor('a3')).toStrictEqual({});
    expect(() => {
      result.current.run({ line: '/fav a3', prefill: false });
    }).not.toThrow();
  });

  it('returns the actions the provider holds', () => {
    const actions: PostActions = {
      linesFor: vi.fn<PostActions['linesFor']>().mockReturnValue({}),
      run: vi.fn<PostActions['run']>(),
    };
    const { result } = renderHook(() => usePostActions(), {
      wrapper: ({ children }) => (
        <PostActionsProvider actions={actions}>{children}</PostActionsProvider>
      ),
    });

    expect(result.current).toBe(actions);
  });

  it('renders its children', () => {
    const actions: PostActions = { linesFor: () => ({}), run: () => undefined };
    const view = render(
      <PostActionsProvider actions={actions}>
        <p>inside</p>
      </PostActionsProvider>,
    );

    expect(view.container).toHaveTextContent('inside');
  });
});
