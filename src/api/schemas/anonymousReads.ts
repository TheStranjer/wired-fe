/**
 * What an instance lets a signed-out visitor read (decision 5), in one shape
 * for every backend. Each of posts, profiles and tags has a `local` and a
 * `remote` value: true is allowed, false is restricted, null is not
 * published. Pleroma-family servers publish `metadata.restrict_unauthenticated`
 * in NodeInfo, where true means restricted, so it is inverted here; Mastodon
 * publishes `configuration.timelines_access.hashtag_feeds` in its v2 instance
 * document (`"public"` is allowed, anything else restricted) and nothing for
 * posts or profiles. A group or key that is missing or malformed gives null.
 */

import * as v from 'valibot';

import { readKey } from './pollLimits';

/** One read: true is allowed, false is restricted, null is not published. */
type AnonymousRead = boolean | null;

/** What a signed-out visitor may read of local and of remote content. */
type AnonymousReadAccess = {
  readonly local: AnonymousRead;
  readonly remote: AnonymousRead;
};

/** What a signed-out visitor may read of posts, profiles and hashtag feeds. */
export type AnonymousReads = {
  readonly posts: AnonymousReadAccess;
  readonly profiles: AnonymousReadAccess;
  readonly tags: AnonymousReadAccess;
};

/** The kinds of content {@link AnonymousReads} tells apart. */
export type AnonymousReadArea = keyof AnonymousReads;

/** Whether the content comes from the instance itself or from other servers. */
export type AnonymousReadLocality = keyof AnonymousReadAccess;

/** Nothing published: what an instance that says nothing, or an old cache entry, holds. */
export const NO_ANONYMOUS_READS: AnonymousReads = {
  posts: { local: null, remote: null },
  profiles: { local: null, remote: null },
  tags: { local: null, remote: null },
};

/** One {@link AnonymousReadAccess} as stored in the profile cache. */
const AccessWireSchema = v.object({
  local: v.nullable(v.boolean()),
  remote: v.nullable(v.boolean()),
});

/** {@link AnonymousReads} as stored in the profile cache. */
export const AnonymousReadsWireSchema: v.GenericSchema<unknown, AnonymousReads> = v.object({
  posts: AccessWireSchema,
  profiles: AccessWireSchema,
  tags: AccessWireSchema,
});

/** The allowed state of a `restrict_unauthenticated` flag: inverted; null unless a boolean. */
function invertedFlag(value: unknown): AnonymousRead {
  return typeof value === 'boolean' ? !value : null;
}

/** The access of one `restrict_unauthenticated` group, whose two keys are {@link keys}. */
function groupAccess(
  group: unknown,
  keys: readonly [local: string, remote: string],
): AnonymousReadAccess {
  return {
    local: invertedFlag(readKey(group, keys[0])),
    remote: invertedFlag(readKey(group, keys[1])),
  };
}

/** The reads a NodeInfo `metadata.restrict_unauthenticated` block publishes. */
export function restrictionReads(block: unknown): AnonymousReads {
  return {
    posts: groupAccess(readKey(block, 'activities'), ['local', 'remote']),
    profiles: groupAccess(readKey(block, 'profiles'), ['local', 'remote']),
    tags: groupAccess(readKey(block, 'timelines'), ['local', 'federated']),
  };
}

/** Allowed for `"public"`, restricted for any other string, null when not a string. */
function feedAccess(value: unknown): AnonymousRead {
  return typeof value === 'string' ? value === 'public' : null;
}

/** The reads a v2 instance `configuration.timelines_access` block publishes: tags only. */
export function timelinesAccessReads(block: unknown): AnonymousReads {
  const feeds = readKey(block, 'hashtag_feeds');
  return {
    ...NO_ANONYMOUS_READS,
    tags: {
      local: feedAccess(readKey(feeds, 'local')),
      remote: feedAccess(readKey(feeds, 'remote')),
    },
  };
}

/** {@link first} where it is published, else {@link second}, for one read. */
function firstPublished(first: AnonymousRead, second: AnonymousRead): AnonymousRead {
  return first ?? second;
}

/** The reads of {@link first} with each unpublished one filled in from {@link second}. */
export function mergeAnonymousReads(first: AnonymousReads, second: AnonymousReads): AnonymousReads {
  const area = (key: AnonymousReadArea): AnonymousReadAccess => ({
    local: firstPublished(first[key].local, second[key].local),
    remote: firstPublished(first[key].remote, second[key].remote),
  });
  return { posts: area('posts'), profiles: area('profiles'), tags: area('tags') };
}
