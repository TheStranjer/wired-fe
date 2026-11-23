/**
 * Tests for the plain-words permissions: whole verbs, narrowed and
 * administrative scopes get sentences, and an unknown scope is shown as it
 * came rather than hidden.
 */
import { describe, expect, it } from 'vitest';

import { describeScope } from './scopeWords';

describe(describeScope, () => {
  it.each([
    ['read', 'Read everything you can see (read)'],
    ['write', 'Post, edit and delete as you (write)'],
    ['follow', 'Follow, unfollow, block and mute accounts (follow)'],
    ['push', 'Send you push notifications (push)'],
    ['read:statuses', 'Read your statuses (read:statuses)'],
    ['write:media_attachments', 'Change your media attachments (write:media_attachments)'],
    ['admin:read', 'As an administrator: Read everything you can see (admin:read)'],
    ['admin:write:accounts', 'As an administrator: Change your accounts (admin:write:accounts)'],
    ['launch:missiles', 'Unknown permission (launch:missiles)'],
    ['', 'Unknown permission ()'],
  ])('puts %j in words', (scope, words) => {
    expect(describeScope(scope)).toBe(words);
  });
});
