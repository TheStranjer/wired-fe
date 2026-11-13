/**
 * Tests for the Relationship schema: a full Mastodon relationship, the defaults
 * a minimal `{ id }` gets, and the Pleroma-only keys that are dropped.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { RelationshipSchema } from './relationship';

/** Parses {@link input}, throwing on invalid input so tests read the output. */
function parse(input: unknown): unknown {
  const result = v.safeParse(RelationshipSchema, input);
  if (!result.success) {
    throw new Error(`unexpected parse failure: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

/** What every flag reads when a backend leaves it out entirely. */
const DEFAULTS = {
  following: false,
  followed_by: false,
  requested: false,
  blocking: false,
  blocked_by: false,
  muting: false,
  muting_notifications: false,
  domain_blocking: false,
  showing_reblogs: true,
  notifying: false,
  endorsed: false,
  note: '',
} as const;

describe('Relationship schema', () => {
  it('passes a full Mastodon relationship through, dropping its extras', () => {
    expect(
      parse({
        id: '9',
        following: true,
        followed_by: true,
        showing_reblogs: false,
        notifying: true,
        languages: null,
        blocked_by: false,
        blocking: false,
        muting: false,
        muting_notifications: false,
        requested: false,
        domain_blocking: false,
        endorsed: true,
        algorithms: null,
        note: 'met at NAC',
      }),
    ).toStrictEqual({
      id: '9',
      following: true,
      followed_by: true,
      requested: false,
      blocking: false,
      blocked_by: false,
      muting: false,
      muting_notifications: false,
      domain_blocking: false,
      showing_reblogs: false,
      notifying: true,
      endorsed: true,
      note: 'met at NAC',
    });
  });

  it('defaults every flag of a bare id, with reblogs still shown', () => {
    expect(parse({ id: '42' })).toStrictEqual({ id: '42', ...DEFAULTS });
  });

  it('drops Pleroma-only keys and keeps the flags it does send', () => {
    expect(
      parse({
        id: '7',
        following: false,
        subscribed: false,
        subscribing: false,
        hiding_reblogs: true,
        blocked_domain: false,
        mute_notifications: false,
        reblogs_notified: false,
        requested: false,
        domain_blocking: false,
      }),
    ).toStrictEqual({
      id: '7',
      following: false,
      followed_by: false,
      requested: false,
      blocking: false,
      blocked_by: false,
      muting: false,
      muting_notifications: false,
      domain_blocking: false,
      showing_reblogs: true,
      notifying: false,
      endorsed: false,
      note: '',
    });
  });

  it('applies defaults around the flags a backend does send', () => {
    expect(parse({ id: '3', muting: true, showing_reblogs: false })).toStrictEqual({
      id: '3',
      ...DEFAULTS,
      muting: true,
      showing_reblogs: false,
    });
  });

  it('fails when id is missing', () => {
    expect(v.safeParse(RelationshipSchema, { following: true }).success).toBe(false);
  });

  it('fails when a flag is not a boolean', () => {
    expect(v.safeParse(RelationshipSchema, { id: '9', following: 'yes' }).success).toBe(false);
  });

  it('fails on a non-object input', () => {
    expect(v.safeParse(RelationshipSchema, '9').success).toBe(false);
  });
});
