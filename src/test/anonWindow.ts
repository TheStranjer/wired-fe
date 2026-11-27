/**
 * The signed-out window the signed-out tests share (AGENTS.md "Testing",
 * WFE-340): nobody is signed in, and one thread window under the key
 * `anon:<origin>` shows the posts a test gives it, with the labels, the
 * selection and the session the target resolver reads. Built through the real
 * reducer, so a command sees exactly what the app would have shown it.
 */

import { fakeCommandContext } from './commandContext';
import type { Status } from '../api/schemas/status';
import type { CommandContext } from '../commands/types';
import { anonKey } from '../state/anonAccount';
import { type AppState, initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { type WindowRef, windowId } from '../windows/model';

/** The instance the visitor reads. */
export const ANON_ORIGIN = 'https://wired.example';

/** The signed-out key of {@link ANON_ORIGIN}. */
export const ANON_KEY = anonKey(ANON_ORIGIN);

/** The signed-out thread window. */
const ANON_THREAD: WindowRef = { kind: 'thread', accountKey: ANON_KEY, target: 'p' };

/** Its id. */
export const ANON_THREAD_ID = windowId(ANON_THREAD);

/** The app state of a visitor with no account reading {@link posts} (API order, newest first) in the signed-out thread. */
export function anonState(posts: readonly Status[], selectedId: string | null = null): AppState {
  const opened = appReducer(initialAppState(), {
    type: 'windows',
    action: { type: 'open', ref: ANON_THREAD, title: 'thread/p' },
  });
  const filled = appReducer(opened, {
    type: 'statuses',
    windowId: ANON_THREAD_ID,
    statuses: posts,
    where: 'newer',
  });
  return selectedId === null
    ? filled
    : appReducer(filled, { type: 'select', windowId: ANON_THREAD_ID, key: `post:${selectedId}` });
}

/** A command context over {@link anonState}. */
export function anonContext(
  posts: readonly Status[],
  selectedId: string | null = null,
): CommandContext {
  const state = anonState(posts, selectedId);
  return fakeCommandContext({ state, windows: state.windows });
}
