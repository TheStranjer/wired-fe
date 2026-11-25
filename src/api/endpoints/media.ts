/**
 * The media endpoints: uploading a file for a post (`POST /api/v2/media`),
 * describing one (`PUT /api/v1/media/:id`) and reading one attachment back
 * (`GET /api/v1/media/:id`). While the server is
 * still processing a file its answer is 202 — 206 to a poll — and its body is
 * already a MediaAttachment, only with `url: null` on Mastodon. The shared
 * {@link MediaAttachmentSchema} stays strict there (a status's attachments are
 * always processed), so this module parses upload answers through a derived
 * schema that reads a null url as the empty string, and {@link uploadAndWait}
 * polls while that url is still empty.
 */
import * as v from 'valibot';

import { type Result, err } from '../../lib/result';
import type { ApiError } from '../errors';
import { type MediaAttachment, MediaAttachmentSchema } from '../schemas/mediaAttachment';
import { type ApiSession, sessionRequestData } from '../session';

/** What an upload sends besides the file: alt text, and the file's name. */
type UploadOptions = {
  readonly description?: string;
  readonly filename?: string;
};

/** Upload options plus {@link uploadAndWait}'s polling knobs. */
type WaitOptions = UploadOptions & {
  /** Sleeps `intervalMs` between polls; injectable so tests never wait on real time. */
  readonly wait?: (ms: number) => Promise<void>;
  /** Milliseconds {@link uploadAndWait} reports to `wait` between polls. */
  readonly intervalMs?: number;
  /** Polls of {@link getMedia} before the wait gives up. */
  readonly maxPolls?: number;
};

/** The default pause between polls, in milliseconds. */
const DEFAULT_INTERVAL_MS = 1_000;

/** How often the wait polls by default: 30 s at {@link DEFAULT_INTERVAL_MS}. */
const DEFAULT_MAX_POLLS = 30;

/** The error of an upload whose url stayed empty for every poll. */
const TIMEOUT_ERROR: ApiError = { kind: 'parse', message: 'Media processing timed out' };

/** Mastodon's processing answer carries `"url": null`; read it as `''`. */
function blankNullUrl(input: unknown): unknown {
  if (typeof input === 'object' && input !== null && 'url' in input && input.url === null) {
    return { ...input, url: '' };
  }
  return input;
}

/** The upload/poll answer: {@link MediaAttachmentSchema}, null url included. */
const ProcessingAttachmentSchema: v.GenericSchema<unknown, MediaAttachment> = v.pipe(
  v.unknown(),
  v.transform(blankNullUrl),
  MediaAttachmentSchema,
);

/** The default `wait`: a real one-second-scale sleep, never used in tests. */
async function defaultWait(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** The multipart body of an upload: the file part, plus alt text when given. */
function mediaForm(file: Blob, options: UploadOptions): FormData {
  const form = new FormData();
  if (options.filename === undefined) {
    form.append('file', file);
  } else {
    form.append('file', file, options.filename);
  }
  if (options.description !== undefined) {
    form.append('description', options.description);
  }
  return form;
}

/**
 * Uploads {@link file} as multipart form data for {@link session}. A 202
 * answer means the server is still processing the file: its attachment then
 * has the empty url {@link uploadAndWait} waits for.
 */
export async function uploadMedia(
  session: ApiSession,
  file: Blob,
  options: UploadOptions,
): Promise<Result<MediaAttachment, ApiError>> {
  return sessionRequestData(session, {
    path: '/api/v2/media',
    method: 'POST',
    form: mediaForm(file, options),
    schema: ProcessingAttachmentSchema,
  });
}

/**
 * Reads attachment {@link id} back from {@link session}'s instance: while the
 * server is still processing the file the answer carries the empty url.
 */
export async function getMedia(
  session: ApiSession,
  id: string,
): Promise<Result<MediaAttachment, ApiError>> {
  return sessionRequestData(session, {
    path: `/api/v1/media/${encodeURIComponent(id)}`,
    schema: ProcessingAttachmentSchema,
  });
}

/** Polls {@link getMedia} for {@link id} until an answer has a url, or the polls run out. */
async function pollMedia(
  session: ApiSession,
  id: string,
  options: WaitOptions,
): Promise<Result<MediaAttachment, ApiError>> {
  const wait = options.wait ?? defaultWait;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const maxPolls = options.maxPolls ?? DEFAULT_MAX_POLLS;
  for (let poll = 0; poll < maxPolls; poll += 1) {
    await wait(intervalMs);
    const polled = await getMedia(session, id);
    if (!polled.ok || polled.value.url !== '') {
      return polled;
    }
  }
  return err(TIMEOUT_ERROR);
}

/**
 * Uploads {@link file} and waits for the server to finish processing it:
 * {@link getMedia} is polled every {@link DEFAULT_INTERVAL_MS} ms — `intervalMs`
 * overridable — at most {@link DEFAULT_MAX_POLLS} times (`maxPolls`) while the
 * answer still has no url, which is how a 202 or 206 processing response shows
 * itself through {@link uploadMedia}'s schema. The first attachment with a
 * non-empty url is returned as is; an upload that answers ready is never
 * polled; a failed poll is returned unchanged; running out of polls answers
 * {@link TIMEOUT_ERROR}.
 */
export async function uploadAndWait(
  session: ApiSession,
  file: Blob,
  options: WaitOptions,
): Promise<Result<MediaAttachment, ApiError>> {
  const uploaded = await uploadMedia(session, file, options);
  if (!uploaded.ok || uploaded.value.url !== '') {
    return uploaded;
  }
  return pollMedia(session, uploaded.value.id, options);
}

/**
 * Sets the alt text of attachment {@link id} on {@link session}'s instance: a
 * PUT to `/api/v1/media/:id` with the description as JSON. An attachment can
 * only be described this way until a post carries it, so a composer that asks
 * for the text after the upload sends it just before the post.
 */
export async function updateMedia(
  session: ApiSession,
  id: string,
  description: string,
): Promise<Result<MediaAttachment, ApiError>> {
  return sessionRequestData(session, {
    path: `/api/v1/media/${encodeURIComponent(id)}`,
    method: 'PUT',
    json: { description },
    schema: ProcessingAttachmentSchema,
  });
}
