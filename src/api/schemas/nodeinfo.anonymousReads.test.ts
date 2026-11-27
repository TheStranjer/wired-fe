/**
 * Tests for the signed-out read policy a NodeInfo document publishes in
 * `metadata.restrict_unauthenticated` (decision 5): wired-be and Pleroma use
 * the same shape, where true means restricted, and it maps to the shared
 * anonymous-reads shape where true means allowed. Missing groups and keys are
 * null, and a Mastodon v2 document maps to the same shape for hashtag feeds.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { type AnonymousReads, NO_ANONYMOUS_READS } from './anonymousReads';
import { InstanceV2Schema } from './instanceV2';
import { NodeInfoSchema } from './nodeinfo';

/** A wired-be NodeInfo document with the given `restrict_unauthenticated` block. */
function wiredDoc(restrict: unknown): unknown {
  return {
    version: '2.1',
    software: { name: 'wired', version: '0.4.0' },
    metadata: { features: ['pleroma_api'], restrict_unauthenticated: restrict },
  };
}

/** A Pleroma NodeInfo document with the given `restrict_unauthenticated` block. */
function pleromaDoc(restrict: unknown): unknown {
  return {
    version: '2.0',
    software: { name: 'pleroma', version: '2.7.0' },
    metadata: { nodeName: 'pleroma.example', restrict_unauthenticated: restrict },
  };
}

/** The policy of {@link input}'s NodeInfo document. */
function readsOfNodeInfo(input: unknown): AnonymousReads {
  const result = v.parse(NodeInfoSchema, input);
  return result.anonymousReads;
}

/** The policy of {@link configuration}'s v2 instance document. */
function readsOfInstance(configuration: unknown): AnonymousReads {
  const result = v.parse(InstanceV2Schema, { title: 'm', version: '4.4.0', configuration });
  return result.anonymousReads;
}

/** A policy restricting everything. */
const RESTRICTED = {
  timelines: { local: true, federated: true },
  profiles: { local: true, remote: true },
  activities: { local: true, remote: true },
};

/** A policy restricting nothing. */
const OPEN = {
  timelines: { local: false, federated: false },
  profiles: { local: false, remote: false },
  activities: { local: false, remote: false },
};

describe('NodeInfo restrict_unauthenticated', () => {
  it.each([
    ['wired-be', wiredDoc],
    ['Pleroma', pleromaDoc],
  ])('inverts a fully restricted %s policy into all false', (_name, doc) => {
    expect(readsOfNodeInfo(doc(RESTRICTED))).toStrictEqual({
      posts: { local: false, remote: false },
      profiles: { local: false, remote: false },
      tags: { local: false, remote: false },
    });
  });

  it.each([
    ['wired-be', wiredDoc],
    ['Pleroma', pleromaDoc],
  ])('inverts an unrestricted %s policy into all true', (_name, doc) => {
    expect(readsOfNodeInfo(doc(OPEN))).toStrictEqual({
      posts: { local: true, remote: true },
      profiles: { local: true, remote: true },
      tags: { local: true, remote: true },
    });
  });

  it('maps activities to posts, profiles to profiles and timelines to tags', () => {
    const reads = readsOfNodeInfo(
      wiredDoc({
        timelines: { local: true, federated: false },
        profiles: { local: false, remote: true },
        activities: { local: true, remote: false },
      }),
    );

    expect(reads).toStrictEqual({
      posts: { local: false, remote: true },
      profiles: { local: true, remote: false },
      tags: { local: false, remote: true },
    });
  });

  it('gives null for a missing group and for a missing or non-boolean key', () => {
    const reads = readsOfNodeInfo(
      pleromaDoc({ timelines: { local: true }, profiles: { local: 'yes', remote: null } }),
    );

    expect(reads).toStrictEqual({
      posts: { local: null, remote: null },
      profiles: { local: null, remote: null },
      tags: { local: false, remote: null },
    });
  });

  it('gives all null without the block or with one that is not an object', () => {
    expect(readsOfNodeInfo(wiredDoc(undefined))).toStrictEqual(NO_ANONYMOUS_READS);
    expect(readsOfNodeInfo(wiredDoc('restricted'))).toStrictEqual(NO_ANONYMOUS_READS);
  });
});

describe('v2 instance timelines_access', () => {
  it('reads "public" as allowed and "authenticated" and "disabled" as restricted', () => {
    const reads = readsOfInstance({
      timelines_access: { hashtag_feeds: { local: 'public', remote: 'authenticated' } },
    });

    expect(reads.tags).toStrictEqual({ local: true, remote: false });
    expect(
      readsOfInstance({
        timelines_access: { hashtag_feeds: { local: 'disabled', remote: 'public' } },
      }).tags,
    ).toStrictEqual({ local: false, remote: true });
  });

  it('publishes nothing for posts and profiles', () => {
    const reads = readsOfInstance({
      timelines_access: { hashtag_feeds: { local: 'public', remote: 'public' } },
    });

    expect(reads.posts).toStrictEqual({ local: null, remote: null });
    expect(reads.profiles).toStrictEqual({ local: null, remote: null });
  });

  it('gives null for a missing block, a missing key or a value that is not a string', () => {
    expect(readsOfInstance({})).toStrictEqual(NO_ANONYMOUS_READS);
    expect(readsOfInstance({ timelines_access: { hashtag_feeds: { local: 3 } } })).toStrictEqual(
      NO_ANONYMOUS_READS,
    );
  });
});
