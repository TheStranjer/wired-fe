/**
 * Summary of `/api/v2/instance` (decision 5): Mastodon's modern document. All
 * limits live under `configuration.statuses` and `configuration.polls`, and
 * `api_versions.mastodon` says how new the API is. There is no Pleroma
 * fallback here. A malformed optional block degrades to null instead of
 * failing the document, which only a missing `title` or `version` does.
 */

import * as v from 'valibot';

import { type AnonymousReads, timelinesAccessReads } from './anonymousReads';
import { extractPollLimits, nonNegativeInt, readKey } from './pollLimits';
import type { PollLimits } from './pollLimits';

/** What WiredFE reads out of a v2 instance document. */
export type InstanceV2 = {
  readonly title: string;
  readonly version: string;
  readonly mastodonApiVersion: number | null;
  readonly maxCharacters: number | null;
  readonly maxMediaAttachments: number | null;
  readonly pollLimits: PollLimits | null;
  /** What `configuration.timelines_access` lets a signed-out visitor read: hashtag feeds only. */
  readonly anonymousReads: AnonymousReads;
};

/** The v2 document as far as this schema cares: only the blocks we read. */
const InstanceV2WireSchema = v.looseObject({
  title: v.string(),
  version: v.string(),
  api_versions: v.optional(v.unknown()),
  configuration: v.optional(v.unknown()),
});

/** Parses a `/api/v2/instance` document into the internal {@link InstanceV2}. */
export const InstanceV2Schema: v.GenericSchema<unknown, InstanceV2> = v.pipe(
  InstanceV2WireSchema,
  v.transform((doc) => {
    const statuses = readKey(doc.configuration, 'statuses');
    return {
      title: doc.title,
      version: doc.version,
      mastodonApiVersion: nonNegativeInt(readKey(doc.api_versions, 'mastodon')),
      maxCharacters: nonNegativeInt(readKey(statuses, 'max_characters')),
      maxMediaAttachments: nonNegativeInt(readKey(statuses, 'max_media_attachments')),
      pollLimits: extractPollLimits(
        readKey(doc.configuration, 'polls'),
        'max_characters_per_option',
      ),
      anonymousReads: timelinesAccessReads(readKey(doc.configuration, 'timelines_access')),
    };
  }),
);
