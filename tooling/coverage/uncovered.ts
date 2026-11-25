/**
 * The diff-coverage rule: every statement, function and branch arm whose
 * source range overlaps a changed line must have run in a test. A changed
 * line that no range covers (types, comments, blank lines) is ignored.
 */
import type { CoverageMap, FileCoverage, Loc } from './coverageMap.ts';
import { type Offender, compareOffenders } from './offender.ts';
import type { ChangedLines } from './parseDiff.ts';

/** The first and last line of `loc`; an absent end is the start. Undefined without a start. */
function lineSpan(loc: Loc | undefined): readonly [number, number] | undefined {
  const start = loc?.start.line;
  if (start === undefined || start === null) {
    return undefined;
  }
  return [start, Math.max(start, loc?.end?.line ?? start)];
}

/** The lowest changed line inside the range `loc` spans, if there is one. */
function firstChanged(changed: ReadonlySet<number>, loc: Loc | undefined): number | undefined {
  const span = lineSpan(loc);
  if (span === undefined) {
    return undefined;
  }
  const inside = [...changed].filter((line) => line >= span[0] && line <= span[1]);
  return inside.length === 0 ? undefined : Math.min(...inside);
}

/** A file's coverage together with the lines changed in it. */
type Subject = {
  readonly file: string;
  readonly coverage: FileCoverage;
  readonly changed: ReadonlySet<number>;
};

/** Statements on a changed line that never ran. */
function statementOffenders({ file, coverage, changed }: Subject): Offender[] {
  return Object.entries(coverage.statementMap).flatMap(([id, loc]) => {
    const line = firstChanged(changed, loc);
    return line !== undefined && (coverage.s[id] ?? 0) === 0
      ? [{ file, line, message: 'statement not run' }]
      : [];
  });
}

/** Functions spanning a changed line that were never called. */
function functionOffenders({ file, coverage, changed }: Subject): Offender[] {
  return Object.entries(coverage.fnMap).flatMap(([id, fn]) => {
    const line = firstChanged(changed, fn.loc ?? fn.decl);
    return line !== undefined && (coverage.f[id] ?? 0) === 0
      ? [{ file, line, message: `function ${fn.name} never called` }]
      : [];
  });
}

/** Branch arms on a changed line that were never taken. */
function branchOffenders({ file, coverage, changed }: Subject): Offender[] {
  return Object.entries(coverage.branchMap).flatMap(([id, branch]) =>
    branch.locations.flatMap((loc, arm) => {
      const line = firstChanged(changed, loc);
      const taken = coverage.b[id]?.[arm] ?? 0;
      return line !== undefined && taken === 0
        ? [
            {
              file,
              line,
              message: `branch ${String(arm + 1)}/${String(branch.locations.length)} not taken`,
            },
          ]
        : [];
    }),
  );
}

/**
 * Every statement, function and branch arm on a changed line that did not
 * run, sorted by file and line. Files with no entry in the coverage map are
 * left to {@link unmappedChanges}.
 */
export function uncoveredChanges(
  diffLines: ChangedLines,
  coverageMap: CoverageMap,
): readonly Offender[] {
  const offenders: Offender[] = [];
  for (const [file, changed] of diffLines) {
    const coverage = coverageMap[file];
    if (coverage !== undefined) {
      const subject = { file, coverage, changed };
      offenders.push(
        ...statementOffenders(subject),
        ...functionOffenders(subject),
        ...branchOffenders(subject),
      );
    }
  }
  return offenders.sort(compareOffenders);
}

/**
 * One offender per changed file that is absent from the coverage map yet has
 * executable code (`hasCode`), reported at its first changed line.
 */
export function unmappedChanges(
  diffLines: ChangedLines,
  coverageMap: CoverageMap,
  hasCode: (file: string) => boolean,
): readonly Offender[] {
  const offenders: Offender[] = [];
  for (const [file, changed] of diffLines) {
    if (coverageMap[file] === undefined && hasCode(file)) {
      const line = Math.min(...changed);
      offenders.push({ file, line, message: 'file is missing from the coverage map' });
    }
  }
  return offenders.sort(compareOffenders);
}
