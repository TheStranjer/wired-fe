/**
 * The command context for one render (decision 6): the seam where the app layer
 * hands the command layer everything it may do. State and dispatch come from the
 * React context, the registry and the stores from their one lazy load, the
 * configuration from the build (decision 3), `page` and `navigate` from
 * `window.location`, and the command line's text back through the `setInput` the
 * caller passes in. Posting is the active window's kind's decision (AGENTS.md
 * "The command line is the composer"): plain text means whatever that window says
 * it means, and a window whose kind cannot post says so.
 */

import { appRegistry } from './registry';
import { appStores } from './stores';
import { loadWindowKinds } from './windowKinds';
import type { CommandContext, PrintLevel, Registry } from '../commands/types';
import { buildConfig } from '../config/config';
import type { Draft } from '../state/draft';
import { useAppDispatch, useAppState } from '../state/StateContext';
import type { PostContext, WindowKindDefinition } from '../state/windowKind';
import { activeWindow } from '../windows/model';
import type { WindowKind, WindowState } from '../windows/model';

/** What the shell says when the active window's kind takes no posts. */
const NO_POST = "You can't post in this window. Try /home";

/** The commands a context carries when the definitions could not be loaded. */
const NO_COMMANDS: Registry = { commands: [], byName: new Map() };

/** The kinds the loader collected; no kinds at all when that load failed. */
function loadedKinds(): ReadonlyMap<WindowKind, WindowKindDefinition> {
  const kinds = loadWindowKinds();
  return kinds.ok ? kinds.value : new Map();
}

/** The self-registered kinds, once, since posting goes through them. */
const KINDS = loadedKinds();

/** The indexed commands; none at all when the definitions could not be loaded. */
function loadedRegistry(): Registry {
  const built = appRegistry();
  return built.ok ? built.value : NO_COMMANDS;
}

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
 * The {@link CommandContext} for this render: everything a command may do with
 * the state as it stands right now. Build one per submit (or per bound hotkey)
 * and hand it to `dispatchInput`; {@link setInput} is the command line's own
 * setter, so a command that prefills or edits the line can rewrite it.
 */
export function useCommandContext(setInput: (text: string) => void): CommandContext {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const active = activeWindow(state.windows);
  const now = (): Date => new Date();

  return {
    print: (text: string, level?: PrintLevel) => {
      dispatch({ type: 'print', windowId: null, date: now(), level: level ?? 'info', text });
    },
    registry: loadedRegistry(),
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
    post: postHandler(active, { state, dispatch, now }),
    setInput,
    navigate: (url: string) => {
      window.location.assign(url);
    },
    page: { origin: window.location.origin, pathname: window.location.pathname },
    config: buildConfig,
    stores: appStores(),
  };
}
