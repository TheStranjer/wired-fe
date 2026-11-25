/**
 * Table tests for the diff-coverage rule: statements, functions, every branch
 * arm, multi-line ranges, and lines no range covers.
 */
import { describe, expect, it } from 'vitest';

import { coverage, range } from './coverageFixture';
import type { CoverageMap } from './coverageMap';
import { uncoveredChanges } from './uncovered';

/** Runs the rule on one file with the given changed lines. */
function check(
  lines: readonly number[],
  pieces: Parameters<typeof coverage>[0],
): readonly string[] {
  const offenders = uncoveredChanges(new Map([['src/x.ts', new Set(lines)]]), {
    'src/x.ts': coverage(pieces),
  });
  return offenders.map(({ file, line, message }) => `${file}:${String(line)} ${message}`);
}

describe(uncoveredChanges, () => {
  it('passes a changed statement that ran', () => {
    expect(check([5], { statements: [[5, 5, 3]] })).toStrictEqual([]);
  });

  it('flags a changed statement that never ran', () => {
    expect(check([5], { statements: [[5, 5, 0]] })).toStrictEqual(['src/x.ts:5 statement not run']);
  });

  it('ignores an unrun statement on a line that did not change', () => {
    expect(check([6], { statements: [[5, 5, 0]] })).toStrictEqual([]);
  });

  it('flags a multi-line statement when only a middle line changed, at that line', () => {
    expect(check([12], { statements: [[10, 14, 0]] })).toStrictEqual([
      'src/x.ts:12 statement not run',
    ]);
  });

  it('flags a multi-line statement changed on its first and on its last line', () => {
    const pieces = { statements: [[10, 14, 0]] } as const;

    expect([check([10], pieces), check([14], pieces)]).toStrictEqual([
      ['src/x.ts:10 statement not run'],
      ['src/x.ts:14 statement not run'],
    ]);
  });

  it('reports the first changed line inside a statement', () => {
    expect(check([14, 11, 3], { statements: [[10, 14, 0]] })).toStrictEqual([
      'src/x.ts:11 statement not run',
    ]);
  });

  it('passes a multi-line statement that ran, however it changed', () => {
    expect(check([11, 12], { statements: [[10, 14, 1]] })).toStrictEqual([]);
  });

  it('flags a changed function that was never called, by name', () => {
    expect(check([22], { functions: [['foo', 20, 30, 0]] })).toStrictEqual([
      'src/x.ts:22 function foo never called',
    ]);
  });

  it('passes a changed function that was called', () => {
    expect(check([22], { functions: [['foo', 20, 30, 2]] })).toStrictEqual([]);
  });

  it('ignores a function whose lines did not change', () => {
    expect(check([40], { functions: [['foo', 20, 30, 0]] })).toStrictEqual([]);
  });

  it('flags only the arm that is on a changed line, numbering the arms', () => {
    const branches = [
      [
        [range(7), range(9)],
        [4, 0],
      ],
    ] as const;

    expect(check([9], { branches })).toStrictEqual(['src/x.ts:9 branch 2/2 not taken']);
  });

  it('flags the first arm too', () => {
    const branches = [
      [
        [range(7), range(9)],
        [0, 4],
      ],
    ] as const;

    expect(check([7], { branches })).toStrictEqual(['src/x.ts:7 branch 1/2 not taken']);
  });

  it('flags every untaken arm that overlaps a change', () => {
    const branches = [
      [
        [range(7), range(8), range(9)],
        [0, 1, 0],
      ],
    ] as const;

    expect(check([7, 8, 9], { branches })).toStrictEqual([
      'src/x.ts:7 branch 1/3 not taken',
      'src/x.ts:9 branch 3/3 not taken',
    ]);
  });

  it('passes arms that were all taken', () => {
    const branches = [
      [
        [range(7), range(9)],
        [1, 1],
      ],
    ] as const;

    expect(check([7, 9], { branches })).toStrictEqual([]);
  });

  it('treats a missing hit count as not run', () => {
    const offenders = uncoveredChanges(new Map([['src/x.ts', new Set([1])]]), {
      'src/x.ts': {
        statementMap: { 0: range(1) },
        s: {},
        fnMap: { 0: { name: 'f', loc: range(1) } },
        f: {},
        branchMap: { 0: { locations: [range(1)] } },
        b: {},
      },
    });

    expect(offenders.map(({ message }) => message)).toStrictEqual([
      'branch 1/1 not taken',
      'function f never called',
      'statement not run',
    ]);
  });

  it('falls back to a function declaration when it has no loc', () => {
    const offenders = uncoveredChanges(new Map([['src/x.ts', new Set([3])]]), {
      'src/x.ts': {
        statementMap: {},
        s: {},
        fnMap: { 0: { name: 'g', decl: range(3) } },
        f: { 0: 0 },
        branchMap: {},
        b: {},
      },
    });

    expect(offenders.map(({ message }) => message)).toStrictEqual(['function g never called']);
  });

  it('takes a range with no end line as one line long', () => {
    const offenders = uncoveredChanges(new Map([['src/x.ts', new Set([3, 4])]]), {
      'src/x.ts': {
        ...coverage({}),
        statementMap: { 0: { start: { line: 3 } } },
        s: { 0: 0 },
      },
    });

    expect(offenders.map(({ line }) => line)).toStrictEqual([3]);
  });

  it.each([null, undefined])('ignores a range whose start line is %s', (line) => {
    const offenders = uncoveredChanges(new Map([['src/x.ts', new Set([3])]]), {
      'src/x.ts': {
        ...coverage({}),
        branchMap: { 0: { locations: [{ start: { line } }] } },
        b: { 0: [0] },
      },
    });

    expect(offenders).toStrictEqual([]);
  });

  it('ignores a changed line that no range covers', () => {
    const pieces = { statements: [[5, 5, 0]], functions: [['f', 5, 5, 0]] } as const;

    expect(check([1, 2, 3], pieces)).toStrictEqual([]);
  });

  it('leaves a file that is not in the map to unmappedChanges', () => {
    expect(uncoveredChanges(new Map([['src/y.ts', new Set([1])]]), {})).toStrictEqual([]);
  });

  it('sorts offenders by file, then line', () => {
    const map: CoverageMap = {
      'src/a.ts': coverage({
        statements: [
          [9, 9, 0],
          [2, 2, 0],
        ],
      }),
      'src/b.ts': coverage({ statements: [[1, 1, 0]] }),
    };
    const diff = new Map([
      ['src/b.ts', new Set([1])],
      ['src/a.ts', new Set([9, 2])],
    ]);

    expect(
      uncoveredChanges(diff, map).map(({ file, line }) => `${file}:${String(line)}`),
    ).toStrictEqual(['src/a.ts:2', 'src/a.ts:9', 'src/b.ts:1']);
  });
});
