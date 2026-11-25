/**
 * The diff-coverage gate end to end, with every outside effect (git, files,
 * environment) injected: scan `src/` for coverage-ignore comments, find the
 * lines changed since the base commit, and check each against the coverage
 * map. `diffCoverage.ts` wires it to the real repository.
 */
import { type Git, resolveBase } from './base.ts';
import { parseCoverageMap } from './coverageMap.ts';
import { hasExecutableCode } from './executable.ts';
import { findIgnoreComments } from './ignoreComments.ts';
import { type Offender, compareOffenders, formatOffender } from './offender.ts';
import { type ChangedLines, isCheckedFile, parseChangedLines } from './parseDiff.ts';
import { uncoveredChanges, unmappedChanges } from './uncovered.ts';

/** Where Vitest's `json` coverage reporter writes, relative to the repository root. */
const COVERAGE_FILE = 'coverage/coverage-final.json';

/** Git pathspecs for the sources; without `:(glob)`, `*` also crosses `/`. */
const SOURCE_PATHSPEC = ['src/*.ts', 'src/*.tsx'];

/** What the gate needs from the outside world. */
export type Io = {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly git: Git;
  /** The repository root, which the coverage map's absolute paths are made relative to. */
  readonly root: string;
  /** The text of a repository-relative file; throws when it cannot be read. */
  readonly readText: (path: string) => string;
  /** Every file under `src/`, repository-relative. */
  readonly sourceFiles: () => readonly string[];
};

/** The gate's verdict and what to print. */
type Report = { readonly lines: readonly string[]; readonly passed: boolean };

/** Lines 1..n of a file added wholesale. */
function everyLine(text: string): ReadonlySet<number> {
  return new Set(Array.from({ length: text.split('\n').length }, (_, index) => index + 1));
}

/**
 * The lines changed since `base`, working tree included. Untracked sources
 * count as changed in full, so a file is checked before it is first added.
 */
function changedLines(io: Io, base: string): ChangedLines {
  const diff = io.git([
    ...['-c', 'core.quotepath=off', 'diff', '-U0', '--no-color', '--no-ext-diff'],
    ...[base, '--', ...SOURCE_PATHSPEC],
  ]);
  if (diff === undefined) {
    throw new Error('git diff failed');
  }
  const lines = new Map(parseChangedLines(diff));
  const untracked = io.git([
    'ls-files',
    '--others',
    '--exclude-standard',
    '--',
    ...SOURCE_PATHSPEC,
  ]);
  for (const file of (untracked ?? '').split('\n').filter(isCheckedFile)) {
    lines.set(file, everyLine(io.readText(file)));
  }
  return lines;
}

/** The uncovered and unmapped changes since `base`. */
function changeProblems(io: Io, base: string): readonly Offender[] {
  const changed = changedLines(io, base);
  if (changed.size === 0) {
    return [];
  }
  const coverage = parseCoverageMap(JSON.parse(io.readText(COVERAGE_FILE)), io.root);
  return [
    ...uncoveredChanges(changed, coverage),
    ...unmappedChanges(changed, coverage, (file) => hasExecutableCode(io.readText(file))),
  ];
}

/**
 * Runs the whole gate. The ignore-comment ban applies everywhere, even where
 * there is no base to diff against; the coverage rule needs a base and is
 * skipped without one.
 */
export function runDiffCoverage(io: Io): Report {
  const sources = io.sourceFiles().map((path) => ({ path, text: io.readText(path) }));
  const problems = [...findIgnoreComments(sources)];
  const base = resolveBase(io.env, io.git);
  const lines: string[] = [];
  if (base === undefined) {
    lines.push('diff coverage: no base, skipped');
  } else {
    problems.push(...changeProblems(io, base));
  }
  problems.sort(compareOffenders);
  lines.push(...problems.map(formatOffender));
  if (problems.length > 0) {
    lines.push(`diff coverage: ${String(problems.length)} problem(s)`);
  }
  return { lines, passed: problems.length === 0 };
}
