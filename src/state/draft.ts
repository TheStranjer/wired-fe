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
import type { Status, Visibility } from '../api/schemas/status';

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

/** The post a bound composer answers or quotes (WFE-244, WFE-262) and the account of the line it came from. */
type BoundPost = {
  /** The bound post, shown dimly above the text; its id is the draft's `inReplyToId` or `quoteId`. */
  readonly status: Status;
  /** The account that fetched the line (decision 14); the one the post goes out as. */
  readonly accountKey: string | null;
};

/** What a composer's fields hold: the text, the content-warning line and the audience. */
export type ComposerFields = {
  readonly text: string;
  /** The content warning line; empty means none. */
  readonly spoiler: string;
  readonly visibility: Visibility;
  /** The poll being edited (WFE-206), options as typed; absent while the poll editor is off. */
  readonly poll?: Draft['poll'];
  /** Ids of uploaded media the post carries; a poll and media exclude each other. */
  readonly mediaIds?: readonly string[] | undefined;
  /** The post this answers, for a reply composer; absent for a plain one (WFE-244). */
  readonly inReplyTo?: BoundPost;
  /** The post this quotes, for a quote composer; absent for a plain one (WFE-262). */
  readonly quoteOf?: BoundPost;
};

/**
 * The draft the composer's fields stand for: the warning is dropped when
 * empty, the poll's options are trimmed, and no media list is sent when empty;
 * a reply composer's draft answers the post it is bound to and a quote composer's quotes it.
 */
export function fieldsToDraft(fields: ComposerFields): Draft {
  const { poll, mediaIds, inReplyTo, quoteOf } = fields;
  return {
    text: fields.text,
    ...(inReplyTo === undefined ? {} : { inReplyToId: inReplyTo.status.id }),
    ...(quoteOf === undefined ? {} : { quoteId: quoteOf.status.id }),
    ...(fields.spoiler === '' ? {} : { spoilerText: fields.spoiler }),
    visibility: fields.visibility,
    ...(mediaIds === undefined || mediaIds.length === 0 ? {} : { mediaIds }),
    ...(poll === undefined
      ? {}
      : { poll: { ...poll, options: poll.options.map((option) => option.trim()) } }),
  };
}

/** One attachment line of a pane composer: a file on its way to the instance, or already there. */
export type ComposerMedia = {
  /** A key of this line alone, so a late upload answer finds its line again. */
  readonly key: string;
  /** The file's own name. */
  readonly name: string;
  readonly status: 'uploading' | 'ready' | 'failed';
  /** The instance's id of the attachment, once it accepted the file. */
  readonly mediaId: string | null;
  /** The thumbnail of an image the instance accepted. */
  readonly previewUrl: string | null;
  /** The alt text the reader typed; empty means none. */
  readonly description: string;
  /** Why the upload failed; empty while it did not. */
  readonly error: string;
};
