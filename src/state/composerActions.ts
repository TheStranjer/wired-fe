/**
 * The composer windows' drafts as pure state (decision 13): what each pane
 * composer holds in its fields, the transitions that edit them, and the limits
 * the posting account's instance puts on them. A pane is persistent, so its
 * text must outlive the component and be reachable from outside it — the
 * command line appends what is typed while the composer is focused. The drafts
 * sit in `AppState.composers` by window id; a closed window's draft is dropped.
 */

import type { AppState } from './appState';
import { COMMAND_LINE_MEDIA } from './composerMedia';
import type { ComposerFields } from './draft';
import { capabilitiesFor } from './selectors';
import type { PollLimits } from '../api/schemas/pollLimits';
import { DEFAULT_POLL_LIMITS, hasFeature } from '../capabilities/capabilities';

/** One thing that can happen to a pane composer's draft. */
export type ComposerAction =
  | {
      readonly type: 'composerEdit';
      readonly windowId: string;
      readonly patch: Partial<ComposerFields>;
    }
  | { readonly type: 'composerAppend'; readonly windowId: string; readonly text: string };

/** The post length of an instance nothing is known about, as src/capabilities counts it. */
const UNKNOWN_MAX_CHARACTERS = 500;

/** What an account's instance allows a post: its length, whether `local` is offered, its polls. */
export type ComposerLimits = {
  readonly maxCharacters: number;
  readonly allowLocal: boolean;
  /** How far a poll may reach there (WFE-206). */
  readonly pollLimits: PollLimits;
};

/** The limits of {@link accountKey}'s instance (decision 5); the unknown-instance ones without it. */
export function composerLimits(state: AppState, accountKey: string | null): ComposerLimits {
  const capabilities = capabilitiesFor(state, accountKey);
  return {
    maxCharacters: capabilities?.maxCharacters ?? UNKNOWN_MAX_CHARACTERS,
    allowLocal: capabilities !== null && hasFeature(capabilities, 'localOnlyPosts'),
    pollLimits: capabilities?.pollLimits ?? DEFAULT_POLL_LIMITS,
  };
}

/** The fields of window {@link windowId}: its draft, or an empty one at the default audience. */
export function composerFields(state: AppState, windowId: string): ComposerFields {
  return (
    state.composers.get(windowId) ?? {
      text: '',
      spoiler: '',
      visibility: state.settings.defaultVisibility,
    }
  );
}

/** Whether window {@link windowId}'s draft holds nothing yet: no text, no warning, no poll, no media, and not bound to a post to answer or quote. */
export function composerIsEmpty(state: AppState, windowId: string): boolean {
  const { text, spoiler, poll, ...bound } = composerFields(state, windowId);
  const media = state.composerMedia.get(windowId) ?? [];
  const bare = text === '' && spoiler === '' && poll === undefined && media.length === 0;
  return (
    bare &&
    bound.inReplyTo === undefined &&
    bound.quoteOf === undefined &&
    bound.editing === undefined
  );
}

/** {@link text} joined under {@link before} on a new line; alone when nothing is there yet. */
function appended(before: string, text: string): string {
  return before === '' ? text : `${before}\n${text}`;
}

/** The composers with window {@link windowId} holding {@link fields}. */
function putFields(state: AppState, windowId: string, fields: ComposerFields): AppState {
  return { ...state, composers: new Map(state.composers).set(windowId, fields) };
}

/** Move the drafts along by one action; the same state when the window is not a composer. */
export function composerReducer(state: AppState, action: ComposerAction): AppState {
  const win = state.windows.windows.find((candidate) => candidate.id === action.windowId);
  if (win?.ref.kind !== 'composer') {
    return state;
  }
  const fields = composerFields(state, action.windowId);
  switch (action.type) {
    case 'composerEdit':
      return putFields(state, action.windowId, { ...fields, ...action.patch });
    case 'composerAppend':
      return putFields(state, action.windowId, {
        ...fields,
        text: appended(fields.text, action.text),
      });
  }
}

/** {@link entries} without the windows that are not in {@link open}; the same map when none is dropped. */
function live<V>(
  entries: ReadonlyMap<string, V>,
  open: ReadonlySet<string>,
): ReadonlyMap<string, V> {
  const kept = [...entries].filter(([id]) => open.has(id));
  return kept.length === entries.size ? entries : new Map(kept);
}

/**
 * The state with only the drafts and media of windows still on the list:
 * closing a composer forgets its text and its attachments, so opening one again
 * starts empty, while the command line's own media (WFE-287) stays. The same
 * state when nothing was dropped.
 */
export function withLiveComposers(state: AppState): AppState {
  const open = new Set([COMMAND_LINE_MEDIA, ...state.windows.windows.map((win) => win.id)]);
  const composers = live(state.composers, open);
  const composerMedia = live(state.composerMedia, open);
  if (composers === state.composers && composerMedia === state.composerMedia) {
    return state;
  }
  return { ...state, composers, composerMedia };
}
