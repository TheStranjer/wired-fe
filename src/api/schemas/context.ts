/**
 * The Context entity schema (decision 7): the tree around one post, as the
 * context endpoint reports it. `ancestors` is the chain above the post, oldest
 * first; `descendants` are the replies below it. Both arrays are always in the
 * response and both are required here; an empty array just means the post sits
 * at the root of a thread with no replies yet. The statuses inside are parsed
 * by the same {@link StatusSchema} the timelines use, so each backend's quirks
 * normalize identically. Any other key on the response object is dropped.
 */

import * as v from 'valibot';

import type { Status } from './status';
import { StatusSchema } from './status';

/** The posts above and below one status, in conversation order. */
export type Context = {
  readonly ancestors: readonly Status[];
  readonly descendants: readonly Status[];
};

/** Parses any backend's context response into the internal {@link Context}. */
export const ContextSchema: v.GenericSchema<unknown, Context> = v.object({
  ancestors: v.array(StatusSchema),
  descendants: v.array(StatusSchema),
});
