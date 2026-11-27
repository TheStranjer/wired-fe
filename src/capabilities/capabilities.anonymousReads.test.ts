/**
 * Tests for the anonymous-read policy in derived capabilities (decision 5):
 * NodeInfo's `restrict_unauthenticated` for the Pleroma family, the v2
 * instance document's `timelines_access` for Mastodon's hashtag feeds, and
 * nothing published as null.
 */
import { describe, expect, it } from 'vitest';

import { deriveCapabilities } from './capabilities';
import { NO_ANONYMOUS_READS } from '../api/schemas/anonymousReads';
import { nodeInfoNamed, v2Doc } from '../test/instanceDocs';

/** Everything restricted: what a locked-down Pleroma-family server publishes. */
const LOCKED = {
  posts: { local: false, remote: false },
  profiles: { local: false, remote: false },
  tags: { local: false, remote: false },
};

describe('capabilities anonymousReads', () => {
  it('takes the policy a Pleroma-family NodeInfo publishes', () => {
    const nodeInfo = { ...nodeInfoNamed('wired'), anonymousReads: LOCKED };

    const caps = deriveCapabilities({ nodeInfo, v1: null, v2: null });

    expect(caps.anonymousReads).toStrictEqual(LOCKED);
  });

  it('takes hashtag feeds from the v2 document and leaves posts and profiles unpublished', () => {
    const v2 = v2Doc({
      anonymousReads: { ...NO_ANONYMOUS_READS, tags: { local: true, remote: false } },
    });

    const caps = deriveCapabilities({ nodeInfo: nodeInfoNamed('mastodon', []), v1: null, v2 });

    expect(caps.anonymousReads).toStrictEqual({
      posts: { local: null, remote: null },
      profiles: { local: null, remote: null },
      tags: { local: true, remote: false },
    });
  });

  it('lets NodeInfo win over the v2 document where both publish', () => {
    const nodeInfo = { ...nodeInfoNamed('pleroma'), anonymousReads: LOCKED };
    const v2 = v2Doc({
      anonymousReads: { ...NO_ANONYMOUS_READS, tags: { local: true, remote: true } },
    });

    const caps = deriveCapabilities({ nodeInfo, v1: null, v2 });

    expect(caps.anonymousReads).toStrictEqual(LOCKED);
  });

  it('is all null when nothing is published', () => {
    const caps = deriveCapabilities({ nodeInfo: nodeInfoNamed('wired'), v1: null, v2: v2Doc() });

    expect(caps.anonymousReads).toStrictEqual(NO_ANONYMOUS_READS);
  });
});
