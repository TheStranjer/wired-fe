/**
 * Summary of `/api/v1/instance` (decision 5). Mastodon keeps its limits under
 * `configuration`; Pleroma and Wired answer with top-level `max_toot_chars`
 * and `poll_limits` and advertise extras in `pleroma.metadata.features`.
 * Only the fields WiredFE reads survive; a malformed optional block degrades
 * to null (or []) instead of failing the document, which only a missing
 * `title` or `version` does.
 */

import * as v from 'valibot';

import { stringList } from './common';
import { extractPollLimits, nonNegativeInt, readKey } from './pollLimits';
import type { PollLimits } from './pollLimits';

/** What WiredFE reads out of any backend's v1 instance document. */
export type InstanceV1 = {
  readonly title: string;
  readonly version: string;
  readonly maxCharacters: number | null;
  readonly maxMediaAttachments: number | null;
  readonly pollLimits: PollLimits | null;
  readonly features: readonly string[];
};

/** The v1 document as far as this schema cares: only the blocks we read. */
const InstanceV1WireSchema = v.looseObject({
  title: v.string(),
  version: v.string(),
  configuration: v.optional(v.unknown()),
  max_toot_chars: v.optional(v.unknown()),
  poll_limits: v.optional(v.unknown()),
  pleroma: v.optional(v.unknown()),
});

/** Parses any backend's `/api/v1/instance` into the internal {@link InstanceV1}. */
export const InstanceV1Schema: v.GenericSchema<unknown, InstanceV1> = v.pipe(
  InstanceV1WireSchema,
  v.transform((doc) => {
    const statuses = readKey(doc.configuration, 'statuses');
    return {
      title: doc.title,
      version: doc.version,
      maxCharacters:
        nonNegativeInt(readKey(statuses, 'max_characters')) ?? nonNegativeInt(doc.max_toot_chars),
      maxMediaAttachments: nonNegativeInt(readKey(statuses, 'max_media_attachments')),
      pollLimits:
        extractPollLimits(readKey(doc.configuration, 'polls'), 'max_characters_per_option') ??
        extractPollLimits(doc.poll_limits, 'max_option_chars'),
      features: stringList(readKey(readKey(doc.pleroma, 'metadata'), 'features')),
    };
  }),
);
