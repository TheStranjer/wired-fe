/**
 * Tests for the gate end to end, with git, the files and the environment
 * replaced by in-memory doubles.
 */
import { describe, expect, it } from 'vitest';

import type { Git } from './base';
import { type Io, runDiffCoverage } from './run';

const SKIPPED = 'diff coverage: no base, skipped';
const DIFF_ARGS =
  '-c core.quotepath=off diff -U0 --no-color --no-ext-diff basesha -- src/*.ts src/*.tsx';
const UNTRACKED_ARGS = 'ls-files --others --exclude-standard -- src/*.ts src/*.tsx';

/** One file's Istanbul coverage with a single statement on `line` that ran `hits` times. */
function statementCoverage(line: number, hits: number): unknown {
  const loc = { start: { line }, end: { line } };
  return { statementMap: { 0: loc }, s: { 0: hits }, fnMap: {}, f: {}, branchMap: {}, b: {} };
}

/** A repository: git answers keyed by arguments, and files keyed by path. */
type Repo = {
  readonly git?: Readonly<Record<string, string>>;
  readonly files?: Readonly<Record<string, string>>;
  readonly env?: Readonly<Record<string, string>>;
};

/** Builds the injected effects from an in-memory repository. */
function io({ git = {}, files = {}, env = {} }: Repo): Io {
  const answer: Git = (args) => git[args.join(' ')];
  return {
    env,
    git: answer,
    root: '/repo',
    readText: (path) => {
      const text = files[path];
      if (text === undefined) {
        throw new Error(`no such file: ${path}`);
      }
      return text;
    },
    sourceFiles: () => Object.keys(files).filter((path) => path.startsWith('src/')),
  };
}

/** A repository on a branch one commit past `basesha`, with the given diff. */
function onBranch(diff: string, files: Readonly<Record<string, string>> = {}): Repo {
  return {
    git: {
      'rev-parse HEAD': 'headsha',
      'merge-base HEAD master': 'basesha',
      [DIFF_ARGS]: diff,
      [UNTRACKED_ARGS]: '',
    },
    files,
  };
}

/** The answers of a git double minus the one for `key`, so that call fails. */
function without(
  answers: Readonly<Record<string, string>> | undefined,
  key: string,
): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(answers ?? {}).filter(([name]) => name !== key));
}

const ADD_LINE_5 = '+++ b/src/a.ts\n@@ -4,0 +5 @@\n+x\n';

describe(runDiffCoverage, () => {
  it('skips, and passes, when there is no base', () => {
    expect(runDiffCoverage(io({ git: { 'rev-parse HEAD': 'headsha' } }))).toStrictEqual({
      lines: [SKIPPED],
      passed: true,
    });
  });

  it('skips on master itself, where HEAD is the base', () => {
    const git = { 'rev-parse HEAD': 'headsha', 'merge-base HEAD master': 'headsha' };

    expect(runDiffCoverage(io({ git }))).toStrictEqual({ lines: [SKIPPED], passed: true });
  });

  it('still bans ignore comments when it skips the diff', () => {
    const files = { 'src/a.ts': 'x\n// v8 ignore next\n' };

    expect(runDiffCoverage(io({ git: { 'rev-parse HEAD': 'h' }, files }))).toStrictEqual({
      lines: [
        SKIPPED,
        'src/a.ts:2 coverage-ignore comment is banned',
        'diff coverage: 1 problem(s)',
      ],
      passed: false,
    });
  });

  it('passes when nothing checked changed, without needing the coverage file', () => {
    expect(runDiffCoverage(io(onBranch('')))).toStrictEqual({ lines: [], passed: true });
  });

  it('passes when every changed line is covered', () => {
    const files = {
      'src/a.ts': 'a\n',
      'coverage/coverage-final.json': JSON.stringify({ '/repo/src/a.ts': statementCoverage(5, 1) }),
    };

    expect(runDiffCoverage(io(onBranch(ADD_LINE_5, files)))).toStrictEqual({
      lines: [],
      passed: true,
    });
  });

  it('fails with the file, the line and a count for an uncovered change', () => {
    const files = {
      'src/a.ts': 'a\n',
      'coverage/coverage-final.json': JSON.stringify({ '/repo/src/a.ts': statementCoverage(5, 0) }),
    };

    expect(runDiffCoverage(io(onBranch(ADD_LINE_5, files)))).toStrictEqual({
      lines: ['src/a.ts:5 statement not run', 'diff coverage: 1 problem(s)'],
      passed: false,
    });
  });

  it('fails a changed file with code that the coverage map lacks', () => {
    const files = {
      'src/a.ts': 'export const a = 1;\n',
      'coverage/coverage-final.json': '{}',
    };

    expect(runDiffCoverage(io(onBranch(ADD_LINE_5, files))).lines).toStrictEqual([
      'src/a.ts:5 file is missing from the coverage map',
      'diff coverage: 1 problem(s)',
    ]);
  });

  it('passes a changed file of types only that the coverage map lacks', () => {
    const files = { 'src/a.ts': 'export type A = number;\n', 'coverage/coverage-final.json': '{}' };

    expect(runDiffCoverage(io(onBranch(ADD_LINE_5, files))).passed).toBe(true);
  });

  it('treats an untracked source file as changed in full', () => {
    const repo = onBranch('', {
      'src/new.ts': 'a\nb\n',
      'coverage/coverage-final.json': JSON.stringify({
        '/repo/src/new.ts': statementCoverage(2, 0),
      }),
    });
    const git = { ...repo.git, [UNTRACKED_ARGS]: 'src/new.ts\nsrc/new.test.ts\nsrc/x.css\n' };

    expect(runDiffCoverage(io({ ...repo, git })).lines).toStrictEqual([
      'src/new.ts:2 statement not run',
      'diff coverage: 1 problem(s)',
    ]);
  });

  it('tolerates git failing to list untracked files', () => {
    const repo = onBranch('');

    expect(runDiffCoverage(io({ ...repo, git: without(repo.git, UNTRACKED_ARGS) })).passed).toBe(
      true,
    );
  });

  it('reports ignore comments and uncovered changes together, sorted', () => {
    const files = {
      'src/a.ts': 'a\n',
      'src/b.ts': '// istanbul ignore next\n',
      'coverage/coverage-final.json': JSON.stringify({ '/repo/src/a.ts': statementCoverage(5, 0) }),
    };

    expect(runDiffCoverage(io(onBranch(ADD_LINE_5, files))).lines).toStrictEqual([
      'src/a.ts:5 statement not run',
      'src/b.ts:1 coverage-ignore comment is banned',
      'diff coverage: 2 problem(s)',
    ]);
  });

  it('throws when git cannot diff', () => {
    const repo = onBranch('');
    const git = without(repo.git, DIFF_ARGS);

    expect(() => runDiffCoverage(io({ ...repo, git }))).toThrow('git diff failed');
  });

  it('throws when changes need the coverage file and it is missing', () => {
    expect(() => runDiffCoverage(io(onBranch(ADD_LINE_5)))).toThrow(
      'no such file: coverage/coverage-final.json',
    );
  });
});
