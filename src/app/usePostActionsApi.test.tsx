/**
 * Tests for the post actions the app lends to cards (WFE-209): the lines come
 * from the shipped registry for the label asked, running goes to the runner
 * the command line registered (the newest one), and running with none
 * registered does nothing.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { usePostActionsApi } from './usePostActionsApi';
import type { PostActionRunner } from './usePostActionsApi';
import { seeded } from '../test/appSessions';

const LINE = { line: '/fav a3', prefill: false };

/** The hook over the shipped registry with nobody signed in. */
function renderApi(): ReturnType<typeof renderHook<ReturnType<typeof usePostActionsApi>, unknown>> {
  return renderHook(() => usePostActionsApi(), { wrapper: seeded([]) });
}

describe(usePostActionsApi, () => {
  it('gives the lines of the commands for the label asked', () => {
    const { actions } = renderApi().result.current;

    expect(actions.linesFor('a3')['boost']).toStrictEqual({ line: '/boost a3', prefill: false });
    expect(actions.linesFor('b7')['fav']).toStrictEqual({ line: '/fav b7', prefill: false });
  });

  it('does nothing when no runner is registered', () => {
    const { actions } = renderApi().result.current;

    expect(actions.run(LINE)).toBeUndefined();
  });

  it('runs a line through the newest registered runner', () => {
    const { actions, register } = renderApi().result.current;
    const first = vi.fn<PostActionRunner>();
    const second = vi.fn<PostActionRunner>();

    register(first);
    register(second);
    actions.run(LINE);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(LINE);
  });
});
