/**
 * Tests for backend identification (decision 5): each known software.name
 * maps onto its family, the Mastodon forks collapse onto `mastodon`, foreign
 * and empty names fall to `unknown`, and the Pleroma-dialect predicate is
 * true exactly for Wired, Pleroma and Akkoma.
 */
import { describe, expect, it } from 'vitest';

import { type Backend, identifyBackend, speaksPleromaDialect } from './backend';
import type { NodeInfo } from '../api/schemas/nodeinfo';

/** The software block of a NodeInfo document reporting {@link name}. */
function softwareNamed(name: string): Pick<NodeInfo, 'software'> {
  return { software: { name, version: '1.0.0' } };
}

const IDENTIFY_CASES: readonly { readonly name: string; readonly expected: Backend }[] = [
  { name: 'wired', expected: 'wired' },
  { name: 'pleroma', expected: 'pleroma' },
  { name: 'akkoma', expected: 'akkoma' },
  { name: 'mastodon', expected: 'mastodon' },
  { name: 'hometown', expected: 'mastodon' },
  { name: 'glitch', expected: 'mastodon' },
  { name: 'glitchsoc', expected: 'mastodon' },
  { name: 'misskey', expected: 'unknown' },
  { name: '', expected: 'unknown' },
];

describe(identifyBackend, () => {
  it.each(IDENTIFY_CASES)('maps the name $name onto $expected', ({ name, expected }) => {
    expect(identifyBackend(softwareNamed(name))).toBe(expected);
  });
});

const DIALECT_CASES: readonly { readonly backend: Backend; readonly expected: boolean }[] = [
  { backend: 'wired', expected: true },
  { backend: 'pleroma', expected: true },
  { backend: 'akkoma', expected: true },
  { backend: 'mastodon', expected: false },
  { backend: 'unknown', expected: false },
];

describe(speaksPleromaDialect, () => {
  it.each(DIALECT_CASES)(
    'reports $backend as Pleroma-dialect: $expected',
    ({ backend, expected }) => {
      expect(speaksPleromaDialect(backend)).toBe(expected);
    },
  );
});
