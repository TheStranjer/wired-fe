/** Tests for validating and re-keying an Istanbul coverage map. */
import { describe, expect, it } from 'vitest';

import { parseCoverageMap } from './coverageMap';

const FILE = {
  path: '/repo/src/a.ts',
  statementMap: { 0: { start: { line: 1, column: 0 }, end: { line: 1, column: 9 } } },
  fnMap: {
    0: {
      name: 'f',
      decl: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
      loc: { start: { line: 1, column: 0 }, end: { line: 3, column: 1 } },
      line: 1,
    },
  },
  branchMap: {
    0: {
      type: 'if',
      loc: { start: { line: 2, column: 0 }, end: { line: 2, column: 5 } },
      locations: [{ start: { line: 2, column: 0 }, end: { line: 2, column: 5 } }, { start: {} }],
      line: 2,
    },
  },
  s: { 0: 1 },
  f: { 0: 1 },
  b: { 0: [1, 0] },
};

describe(parseCoverageMap, () => {
  it('re-keys files by their path relative to the root', () => {
    const map = parseCoverageMap({ '/repo/src/a.ts': FILE, '/repo/src/ui/B.tsx': FILE }, '/repo');

    expect(Object.keys(map)).toStrictEqual(['src/a.ts', 'src/ui/B.tsx']);
  });

  it('keeps the statement, function and branch data', () => {
    const file = parseCoverageMap({ '/repo/src/a.ts': FILE }, '/repo')['src/a.ts'];

    expect(file?.b).toStrictEqual({ 0: [1, 0] });
    expect(file?.fnMap['0']?.name).toBe('f');
    expect(file?.branchMap['0']?.locations).toHaveLength(2);
  });

  it('accepts an empty map', () => {
    expect(parseCoverageMap({}, '/repo')).toStrictEqual({});
  });

  it.each([null, 7, { '/repo/src/a.ts': {} }, { '/repo/src/a.ts': { ...FILE, s: { 0: 'x' } } }])(
    'rejects %j',
    (json) => {
      expect(() => parseCoverageMap(json, '/repo')).toThrow(/Invalid/u);
    },
  );
});
