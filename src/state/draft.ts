/**
 * The draft: one unfinished post as the command line and the window kinds hold
 * it before anything is sent (AGENTS.md "Layout": src/state is the pure app
 * state, and this lives here so both the command layer and the window kinds —
 * which may import state — can share the shape). {@link draftToNewStatus}
 * turns one into the API's create payload, filling visibility from the
 * reader's default and dropping an empty content warning, so nothing reaches
 * the server as a blank spoiler.
 */

import type { NewStatus } from '../api/endpoints/statusWrite';
import type { Visibility } from '../api/schemas/status';

/** One post in progress: the text plus everything optional about sending it. */
export type Draft = {
  /** The post text, as typed. */
  readonly text: string;
  /** The content warning shown instead of the text; empty means none. */
  readonly spoilerText?: string;
  /** Who may see it; absent means the reader's default audience. */
  readonly visibility?: Visibility;
  /** Ids of already-uploaded media attachments, in order. */
  readonly mediaIds?: readonly string[];
  /** The poll to attach, in the shape {@link NewStatus} sends. */
  readonly poll?: NonNullable<NewStatus['poll']>;
  /** The status this answers; a reply in a thread sets it. */
  readonly inReplyToId?: string;
  /** The status this quotes. */
  readonly quoteId?: string;
};

/**
 * The {@link NewStatus} to send for {@link draft}: the text and the audience
 * (the draft's own when it names one, {@link defaultVisibility} otherwise),
 * plus every other field the draft set; an empty spoilerText counts as unset.
 */
export function draftToNewStatus(draft: Draft, defaultVisibility: Visibility): NewStatus {
  return {
    status: draft.text,
    ...(draft.spoilerText === undefined || draft.spoilerText === ''
      ? {}
      : { spoilerText: draft.spoilerText }),
    visibility: draft.visibility ?? defaultVisibility,
    ...(draft.mediaIds === undefined ? {} : { mediaIds: draft.mediaIds }),
    ...(draft.poll === undefined ? {} : { poll: draft.poll }),
    ...(draft.inReplyToId === undefined ? {} : { inReplyToId: draft.inReplyToId }),
    ...(draft.quoteId === undefined ? {} : { quoteId: draft.quoteId }),
  };
}

/** What a composer's fields hold: the text, the content-warning line and the audience. */
export type ComposerFields = {
  readonly text: string;
  /** The content warning line; empty means none. */
  readonly spoiler: string;
  readonly visibility: Visibility;
};

/** The draft the composer's fields stand for: the warning is dropped when empty. */
export function fieldsToDraft(fields: ComposerFields): Draft {
  return {
    text: fields.text,
    ...(fields.spoiler === '' ? {} : { spoilerText: fields.spoiler }),
    visibility: fields.visibility,
  };
}
