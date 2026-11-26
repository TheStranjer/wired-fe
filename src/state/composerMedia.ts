/**
 * The media of the composer windows as pure state (decision 13, WFE-205): the
 * attachments of one draft belong to its window, by window id, so two composers
 * keep separate media and a pane that is not shown keeps its uploads. Each line
 * is an upload under way, an attachment the instance accepted, or the reason one
 * failed; the alt text is typed on the line and sent with the post. The DM and
 * thread windows' docked boxes hold media the same way (WFE-289). A closed
 * window's media is dropped with its draft (./composerActions).
 */

import type { AppState } from './appState';
import type { ComposerMedia, Draft } from './draft';
import { capabilitiesFor } from './selectors';
import type { MediaAttachment } from './uploadAttachment';
import { DEFAULT_MAX_MEDIA_ATTACHMENTS } from '../capabilities/capabilities';
import type { WindowKind } from '../windows/model';

/**
 * The reserved key the command line's own pending media (WFE-287) lives under,
 * beside the composers' window ids. No window has this id, so the slice is never
 * mistaken for a composer's and is kept when composers are swept.
 */
export const COMMAND_LINE_MEDIA = 'command-line';

/** The kinds of window that hold media of their own: the composer, and the DM and thread windows with a docked box (WFE-289). */
const MEDIA_KINDS: ReadonlySet<WindowKind> = new Set(['composer', 'dm', 'thread']);

/** Whether a window of {@link kind} has a box to attach media to. */
export function carriesMedia(kind: WindowKind): boolean {
  return MEDIA_KINDS.has(kind);
}

/** One thing that can happen to a pane composer's media. */
export type ComposerMediaAction =
  | { readonly type: 'composerMediaAdd'; readonly windowId: string; readonly item: ComposerMedia }
  | {
      readonly type: 'composerMediaPatch';
      readonly windowId: string;
      readonly key: string;
      readonly patch: Partial<ComposerMedia>;
    }
  | { readonly type: 'composerMediaRemove'; readonly windowId: string; readonly key: string }
  | { readonly type: 'composerMediaClear'; readonly windowId: string };

/** The line of a file {@link name} that is going up under {@link key}. */
export function uploadingMedia(key: string, name: string): ComposerMedia {
  return {
    key,
    name,
    status: 'uploading',
    mediaId: null,
    previewUrl: null,
    description: '',
    error: '',
  };
}

/** What a line becomes once the instance accepted {@link attachment}: ready, with a thumbnail for pictures. */
export function readyPatch(attachment: MediaAttachment): Partial<ComposerMedia> {
  const picture = attachment.type === 'image' || attachment.type === 'gifv';
  return {
    status: 'ready',
    mediaId: attachment.id,
    previewUrl: picture ? (attachment.preview_url ?? attachment.url) : null,
  };
}

/** What a line becomes when its upload failed for {@link error}. */
export function failedPatch(error: string): Partial<ComposerMedia> {
  return { status: 'failed', error };
}

const NO_MEDIA: readonly ComposerMedia[] = [];

/** The media of window {@link windowId}'s composer, in the order it was attached. */
export function composerMediaOf(state: AppState, windowId: string): readonly ComposerMedia[] {
  return state.composerMedia.get(windowId) ?? NO_MEDIA;
}

/** How many lines count against the cap: every one that did not fail. */
export function heldCount(media: readonly ComposerMedia[]): number {
  return media.filter((item) => item.status !== 'failed').length;
}

/** The most attachments a post may carry as {@link accountKey} (decision 5). */
export function maxMedia(state: AppState, accountKey: string | null): number {
  return capabilitiesFor(state, accountKey)?.maxMediaAttachments ?? DEFAULT_MAX_MEDIA_ATTACHMENTS;
}

/** The composers' media with window {@link windowId} holding {@link media}; an empty list leaves no entry. */
function putMedia(state: AppState, windowId: string, media: readonly ComposerMedia[]): AppState {
  const next = new Map(state.composerMedia);
  if (media.length === 0) {
    next.delete(windowId);
  } else {
    next.set(windowId, media);
  }
  return { ...state, composerMedia: next };
}

/**
 * Move the composers' media along by one action; the same state when the window
 * holds none (not a composer, DM or thread), unless the action names {@link COMMAND_LINE_MEDIA}.
 */
export function composerMediaReducer(state: AppState, action: ComposerMediaAction): AppState {
  const win = state.windows.windows.find((candidate) => candidate.id === action.windowId);
  const holds = win !== undefined && carriesMedia(win.ref.kind);
  if (action.windowId !== COMMAND_LINE_MEDIA && !holds) {
    return state;
  }
  const media = composerMediaOf(state, action.windowId);
  switch (action.type) {
    case 'composerMediaAdd':
      return putMedia(state, action.windowId, [...media, action.item]);
    case 'composerMediaPatch':
      return putMedia(
        state,
        action.windowId,
        media.map((item) => (item.key === action.key ? { ...item, ...action.patch } : item)),
      );
    case 'composerMediaRemove':
      return putMedia(
        state,
        action.windowId,
        media.filter((item) => item.key !== action.key),
      );
    case 'composerMediaClear':
      return putMedia(state, action.windowId, NO_MEDIA);
  }
}

/** The ids of the attachments of {@link media} the instance accepted, in order. */
export function mediaIdsOf(media: readonly ComposerMedia[]): readonly string[] {
  return media.flatMap((item) => (item.mediaId === null ? [] : [item.mediaId]));
}

/** {@link draft} carrying, after the ids it has, those of the attachments of {@link media} the instance accepted. */
export function draftWithMedia(draft: Draft, media: readonly ComposerMedia[]): Draft {
  const mediaIds = [...(draft.mediaIds ?? []), ...mediaIdsOf(media)];
  return mediaIds.length === 0 ? draft : { ...draft, mediaIds };
}
