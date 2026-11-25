/**
 * The command context for one render (decision 6): the seam where the app layer
 * hands the command layer everything it may do. State and dispatch come from the
 * React context, the registry and the stores from their one lazy load, the
 * configuration from the build (decision 3), `page` and `navigate` from
 * `window.location`, the command line's text back through the `setInput` the
 * caller passes in and its current text as `line`, the
 * pending media (WFE-126) through the `attachments` Root's useAttachments
 * hands down, the registry narrowed to what the active account's backend can
 * do (WFE-172), and the key-binding helpers (WFE-130) from src/keys: the
 * effective keymap — the registry's defaults under the reader's overrides —
 * flattened into the bindings `/binds` prints. Posting is the active window's
 * kind's decision (AGENTS.md "The command line is the composer"): plain text
 * means whatever that window says it means, and a window whose kind cannot
 * post says so.
 */

import { useMemo } from 'react';

import { DEVICE_CLASS } from './readDeviceClass';
import { appStores } from './stores';
import { requestSync } from './syncRequests';
import { useAvailableRegistry } from './useAvailableRegistry';
import { loadWindowKinds } from './windowKinds';
import type { CommandContext, PrintLevel } from '../commands/types';
import { buildConfig } from '../config/config';
import { blocksTyping, parseSequence } from '../keys/chord';
import { buildKeymap } from '../keys/keymap';
import { printAction } from '../state/appState';
import type { Draft } from '../state/draft';
import { useRefreshDeps } from '../state/RefreshContext';
import { useAppDispatch, useAppState } from '../state/StateContext';
import type { PostContext, WindowKindDefinition } from '../state/windowKind';
import { activeWindow } from '../windows/model';
import type { WindowKind, WindowState } from '../windows/model';

/** What the shell says when the active window's kind takes no posts. */
const NO_POST = "You can't post in this window. Try /home";

/** The kinds the loader collected; no kinds at all when that load failed. */
function loadedKinds(): ReadonlyMap<WindowKind, WindowKindDefinition> {
  const kinds = loadWindowKinds();
  return kinds.ok ? kinds.value : new Map();
}

/** The self-registered kinds, once, since posting goes through them. */
const KINDS = loadedKinds();

/**
 * What posting in {@link win} means: its kind's own post handler, given the
 * window and a {@link PostContext}, or the refusal when its kind has none.
 */
function postHandler(win: WindowState, postContext: PostContext): CommandContext['post'] {
  const onPost = KINDS.get(win.ref.kind)?.onPost;
  if (onPost === undefined) {
    return async () => await Promise.resolve(NO_POST);
  }
  return async (draft: Draft) => await onPost(draft, win, postContext);
}

/**
 * {@link draft} with the ids of {@link attachments}' pending media when it
 * names none of its own (WFE-126); the same draft otherwise, so a window that
 * already picked its media keeps exactly that list.
 */
function withPendingMedia(draft: Draft, attachments: CommandContext['attachments']): Draft {
  const carries = draft.mediaIds !== undefined && draft.mediaIds.length > 0;
  if (carries || attachments.pending.length === 0) {
    return draft;
  }
  return { ...draft, mediaIds: attachments.pending.map((media) => media.id) };
}

/**
 * The context's post: the draft goes out carrying the pending media, and a
 * send that worked takes those ids out of the list with it — a refused post
 * keeps its media for the retry.
 */
function posting(
  win: WindowState,
  postContext: PostContext,
  attachments: CommandContext['attachments'],
): CommandContext['post'] {
  const send = postHandler(win, postContext);
  return async (draft: Draft) => {
    const error = await send(withPendingMedia(draft, attachments));
    if (error === null) {
      attachments.clear();
    }
    return error;
  };
}

/**
 * The {@link CommandContext} for this render: everything a command may do with
 * the state as it stands right now. Build one per submit (or per bound hotkey)
 * and hand it to `dispatchInput`; {@link setInput} is the command line's own
 * setter, so a command that prefills or edits the line can rewrite it,
 * {@link line} is what the command line holds (`/compose` takes a half-typed
 * post from it), and {@link attachments} is the app's way to hold media for
 * the next post (WFE-126).
 */
export function useCommandContext(
  setInput: (text: string) => void,
  attachments: CommandContext['attachments'],
  line: string,
): CommandContext {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const active = activeWindow(state.windows);
  const refresh = useRefreshDeps();
  const now = (): Date => new Date();
  const registry = useAvailableRegistry();
  const overrides = state.settings.keyOverrides;
  const keymap = useMemo(() => buildKeymap(registry, overrides), [registry, overrides]);

  return {
    print: (text: string, level?: PrintLevel) => {
      dispatch(printAction(null, level ?? 'info', text));
    },
    registry,
    windows: state.windows,
    dispatchWindows: (action) => {
      dispatch({ type: 'windows', action });
    },
    clearActiveWindow: () => {
      dispatch({ type: 'clear', windowId: active.id });
    },
    state,
    dispatch,
    now,
    post: posting(active, { state, dispatch, now, refresh }, attachments),
    setInput,
    line,
    attachments,
    keys: { parseChord: parseSequence, blocksTyping, keymap },
    navigate: (url: string) => {
      window.location.assign(url);
    },
    page: { origin: window.location.origin, pathname: window.location.pathname },
    deviceClass: DEVICE_CLASS,
    requestSync,
    config: buildConfig,
    stores: appStores(),
  };
}
