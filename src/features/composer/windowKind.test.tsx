/**
 * Tests for the composer window kind's definition: the kind it self-registers,
 * the topic line naming the account it posts as, and that text typed at the
 * command line while it is focused is appended to the draft instead of
 * posting. The window's own behaviour is in ComposerWindow.test.tsx.
 */
import { describe, expect, it, vi } from 'vitest';

import { openedComposer } from './composerSession';
import { windowKind } from './windowKind';
import type { Draft } from '../../state/draft';
import type { PostContext } from '../../state/windowKind';
import { activeWindow } from '../../windows/model';
import type { WindowState } from '../../windows/model';

/** What posting in the composer kind does, failing when the kind cannot post at all. */
async function post(draft: Draft, win: WindowState, context: PostContext): Promise<string | null> {
  const onPost = windowKind.onPost;
  if (onPost === undefined) {
    throw new Error('the composer window kind takes no posts');
  }
  return await onPost(draft, win, context);
}

describe('the composer window kind', () => {
  it('is the definition for the composer kind, and it takes posts', () => {
    expect(windowKind.kind).toBe('composer');
    expect(windowKind.Component).toBeTypeOf('function');
    expect(windowKind.onPost).toBeTypeOf('function');
  });

  it('topics its window with the account it posts as', () => {
    const state = openedComposer();

    expect(windowKind.topic(activeWindow(state.windows), state)).toBe(
      'composer, posting as @lain@wired.example',
    );
  });

  it('topics a window whose account is gone with the bare kind', () => {
    const state = openedComposer();
    const win = activeWindow(state.windows);
    const orphan: WindowState = { ...win, ref: { ...win.ref, accountKey: 'ghost' } };

    expect(windowKind.topic(orphan, state)).toBe('composer');
  });

  it('puts what is typed at the command line into the draft instead of posting', async () => {
    const state = openedComposer();
    const dispatch = vi.fn<PostContext['dispatch']>();
    const context: PostContext = { state, dispatch, now: () => new Date() };

    const outcome = await post({ text: 'from the line' }, activeWindow(state.windows), context);

    expect(outcome).toBeNull();
    expect(dispatch).toHaveBeenCalledWith({
      type: 'composerAppend',
      windowId: state.windows.activeId,
      text: 'from the line',
    });
  });
});
