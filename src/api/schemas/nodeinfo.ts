/**
 * The NodeInfo documents read on connect (decision 5): the `links` answer of
 * `/.well-known/nodeinfo` and the 2.x document the chosen link points at. Of
 * that document only `version` and `software.name` are required; `software.name`
 * is lowercased, `software.version` falls back to `''` and `openRegistrations`
 * to null. The free-form `metadata` block is straightened out here:
 * Pleroma-family servers advertise their capabilities as a `features` string
 * array (non-strings in it are dropped), Mastodon-family servers their display
 * name as `nodeName`; both fall back when the shape is not there.
 */

import * as v from 'valibot';

import { stringList } from './common';
import { readKey } from './pollLimits';

/** The discovery answer: one rel-and-href entry per advertised NodeInfo version. */
export type NodeInfoLinks = {
  readonly links: readonly { readonly rel: string; readonly href: string }[];
};

/** What WiredFE reads out of a NodeInfo 2.x document. */
export type NodeInfo = {
  readonly version: string;
  readonly software: { readonly name: string; readonly version: string };
  readonly openRegistrations: boolean | null;
  readonly features: readonly string[];
  readonly nodeName: string | null;
};

/** Parses the link list: entries need a `rel` and an `href`, the rest is dropped. */
export const NodeInfoLinksSchema: v.GenericSchema<unknown, NodeInfoLinks> = v.object({
  links: v.array(v.object({ rel: v.string(), href: v.string() })),
});

/** The 2.x document as far as this schema cares: only the blocks we read. */
const NodeInfoWireSchema = v.object({
  version: v.string(),
  software: v.object({
    name: v.string(),
    version: v.optional(v.string(), ''),
  }),
  openRegistrations: v.optional(v.nullable(v.boolean()), null),
  metadata: v.optional(v.unknown()),
});

/** The string of an unknown value; null when it is absent or not a string. */
function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Parses a NodeInfo 2.x document into the internal {@link NodeInfo}. */
export const NodeInfoSchema: v.GenericSchema<unknown, NodeInfo> = v.pipe(
  NodeInfoWireSchema,
  v.transform((doc) => ({
    version: doc.version,
    software: { name: doc.software.name.toLowerCase(), version: doc.software.version },
    openRegistrations: doc.openRegistrations,
    features: stringList(readKey(doc.metadata, 'features')),
    nodeName: stringOrNull(readKey(doc.metadata, 'nodeName')),
  })),
);
