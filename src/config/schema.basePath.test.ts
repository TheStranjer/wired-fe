/**
 * Tests for the `basePath` field of the build-time configuration: the path
 * the bundle is hosted under.
 */
import { describe, expect, it } from 'vitest';

import { parseWiredConfig } from './schema';

/** A configuration with {@link basePath} added to a same-origin one. */
function withBase(basePath: unknown): unknown {
  return { appName: 'WiredFE', instances: { mode: 'same-origin' }, basePath };
}

describe('basePath', () => {
  it.each(['/', '/fe/', '/a/b/'])('accepts %j', (basePath) => {
    const result = parseWiredConfig(withBase(basePath));

    expect(result.ok && result.value.basePath).toBe(basePath);
  });

  it('may be left out', () => {
    const result = parseWiredConfig({ appName: 'WiredFE', instances: { mode: 'same-origin' } });

    expect(result.ok && result.value.basePath).toBeUndefined();
  });

  it.each(['', 'fe/', '/fe', '//', '/fe//', '/fe/?x=1', '/fe/#a', '/f e/', 3])(
    'rejects %j',
    (basePath) => {
      const result = parseWiredConfig(withBase(basePath));

      expect(!result.ok && result.error.some((m) => m.startsWith('basePath: '))).toBe(true);
    },
  );
});
