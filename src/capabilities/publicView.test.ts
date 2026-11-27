/**
 * Tests for the signed-out viewing decision (decisions 3 and 5): the full
 * table of build setting against what the backend published, with `conflict`
 * only when the build forces a read the backend restricted.
 */
import { describe, expect, it } from 'vitest';

import { decidePublicView } from './publicView';
import type {
  AnonymousReadArea,
  AnonymousReadLocality,
  AnonymousReads,
} from '../api/schemas/anonymousReads';
import type { PublicViewSetting } from '../lib/publicViewSetting';

/** Reads where every value is {@link value}. */
function allReads(value: boolean | null): AnonymousReads {
  const access = { local: value, remote: value };
  return { posts: access, profiles: access, tags: access };
}

/** One row: the setting, the backend's value, and the expected outcome. */
type Row = {
  readonly setting: PublicViewSetting;
  readonly value: boolean | null;
  readonly allowed: boolean;
  readonly conflict: boolean;
};

const TABLE: readonly Row[] = [
  { setting: 'off', value: true, allowed: false, conflict: false },
  { setting: 'off', value: false, allowed: false, conflict: false },
  { setting: 'off', value: null, allowed: false, conflict: false },
  { setting: 'force', value: true, allowed: true, conflict: false },
  { setting: 'force', value: false, allowed: true, conflict: true },
  { setting: 'force', value: null, allowed: true, conflict: false },
  { setting: 'backend', value: true, allowed: true, conflict: false },
  { setting: 'backend', value: false, allowed: false, conflict: false },
  { setting: 'backend', value: null, allowed: true, conflict: false },
];

/** Reads that differ by area and locality, so a wrong lookup shows. */
const MIXED: AnonymousReads = {
  posts: { local: true, remote: false },
  profiles: { local: false, remote: true },
  tags: { local: null, remote: false },
};

/** Area, locality and whether `backend` allows that read of {@link MIXED}. */
const LOOKUPS: readonly (readonly [AnonymousReadArea, AnonymousReadLocality, boolean])[] = [
  ['posts', 'local', true],
  ['posts', 'remote', false],
  ['profiles', 'local', false],
  ['profiles', 'remote', true],
  ['tags', 'local', true],
  ['tags', 'remote', false],
];

describe(decidePublicView, () => {
  it.each(TABLE)('$setting with the backend at $value', ({ setting, value, allowed, conflict }) => {
    const decision = decidePublicView(setting, allReads(value), {
      area: 'posts',
      locality: 'local',
    });

    expect(decision).toStrictEqual({ allowed, conflict });
  });

  it.each(LOOKUPS)('reads %s %s from the backend policy', (area, locality, allowed) => {
    expect(decidePublicView('backend', MIXED, { area, locality }).allowed).toBe(allowed);
  });

  it('flags a conflict only for the read the backend restricted', () => {
    const restricted = { area: 'tags', locality: 'remote' } as const;
    const open = { area: 'tags', locality: 'local' } as const;

    expect(decidePublicView('force', MIXED, restricted).conflict).toBe(true);
    expect(decidePublicView('force', MIXED, open).conflict).toBe(false);
  });
});
