/**
 * Tests for posting from a signed-out window (WFE-340): a create under an
 * `anon:<origin>` key is refused with the shared sign-in message and sends
 * nothing (MSW fails any request no handler answers).
 */
import { describe, expect, it, vi } from 'vitest';

import { anonKey } from './anonAccount';
import { initialAppState } from './appState';
import { createPost, postStatus } from './postStatus';
import type { PostContext } from './windowKind';
import { err } from '../lib/result';
import { TEST_DATE } from '../test/fixtures';

const SIGN_IN = 'Sign in to do that: this window is read-only. Type /connect to log in.';
const KEY = anonKey('https://wired.example');

/** A post context for a visitor with no account, and the dispatch it records. */
function visitor(): { readonly context: PostContext; readonly dispatch: PostContext['dispatch'] } {
  const dispatch = vi.fn<PostContext['dispatch']>();
  return {
    context: { state: initialAppState(), dispatch, now: () => new Date(TEST_DATE) },
    dispatch,
  };
}

describe('posting from a signed-out window', () => {
  it('refuses a create, saying to sign in', async () => {
    const { context } = visitor();

    await expect(createPost(context, KEY, { text: 'hello' })).resolves.toStrictEqual(err(SIGN_IN));
  });

  it('hands that refusal to the reader and moves no buffer', async () => {
    const { context, dispatch } = visitor();

    const message = await postStatus(context, {
      accountKey: KEY,
      windowId: 'w',
      draft: { text: 'hi' },
    });

    expect(message).toBe(SIGN_IN);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
