/**
 * Builders for Istanbul coverage fixtures, shared by the tests of the
 * diff-coverage rules.
 */
import type { FileCoverage, Loc } from './coverageMap.ts';

/** A source range from line `from` to line `to`. */
export function range(from: number, to: number = from): Loc {
  return { start: { line: from }, end: { line: to } };
}

/** The statements, functions and branches to put into a {@link coverage} fixture. */
type Pieces = {
  readonly statements?: readonly (readonly [from: number, to: number, hits: number])[];
  readonly functions?: readonly (readonly [name: string, from: number, to: number, hits: number])[];
  readonly branches?: readonly (readonly [arms: readonly Loc[], hits: readonly number[]])[];
};

/** Builds one file's Istanbul coverage from the pieces, numbering them from 0. */
export function coverage(pieces: Pieces): FileCoverage {
  const { statements = [], functions = [], branches = [] } = pieces;
  return {
    statementMap: Object.fromEntries(statements.map(([from, to], id) => [id, range(from, to)])),
    s: Object.fromEntries(statements.map(([, , hits], id) => [id, hits])),
    fnMap: Object.fromEntries(
      functions.map(([name, from, to], id) => [id, { name, loc: range(from, to) }]),
    ),
    f: Object.fromEntries(functions.map(([, , , hits], id) => [id, hits])),
    branchMap: Object.fromEntries(branches.map(([arms], id) => [id, { locations: [...arms] }])),
    b: Object.fromEntries(branches.map(([, hits], id) => [id, [...hits]])),
  };
}
