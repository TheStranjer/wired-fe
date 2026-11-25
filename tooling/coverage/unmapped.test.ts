/** Tests for the rule that a changed file with code must be in the coverage map. */
import { describe, expect, it } from 'vitest';

import { coverage } from './coverageFixture';
import type { CoverageMap } from './coverageMap';
import { unmappedChanges } from './uncovered';

describe(unmappedChanges, () => {
  const diff = new Map([
    ['src/new.ts', new Set([8, 3])],
    ['src/types.ts', new Set([1])],
    ['src/known.ts', new Set([1])],
  ]);
  const map: CoverageMap = { 'src/known.ts': coverage({}) };

  it('flags a changed file with code that the map lacks, at its first changed line', () => {
    expect(unmappedChanges(diff, map, (file) => file === 'src/new.ts')).toStrictEqual([
      { file: 'src/new.ts', line: 3, message: 'file is missing from the coverage map' },
    ]);
  });

  it('leaves a file without executable code alone', () => {
    expect(unmappedChanges(diff, map, () => false)).toStrictEqual([]);
  });

  it('never asks about a file the map has, even an empty one', () => {
    expect(
      unmappedChanges(new Map([['src/known.ts', new Set([1])]]), map, () => true),
    ).toStrictEqual([]);
  });

  it('reports several files sorted by path', () => {
    const files = new Map([
      ['src/b.ts', new Set([1])],
      ['src/a.ts', new Set([2])],
    ]);

    expect(unmappedChanges(files, {}, () => true).map(({ file }) => file)).toStrictEqual([
      'src/a.ts',
      'src/b.ts',
    ]);
  });
});
