/**
 * Choosing the commit the diff-coverage gate compares against. Git is
 * injected, so the choice is testable without a repository.
 */

/** Runs git with the arguments and returns its stdout, or undefined when it fails. */
export type Git = (args: readonly string[]) => string | undefined;

/** Stdout of a git call, trimmed; undefined when the call failed or printed nothing. */
function gitLine(git: Git, args: readonly string[]): string | undefined {
  const out = git(args)?.trim();
  return out === undefined || out === '' ? undefined : out;
}

/**
 * The commit to diff against: `$COVERAGE_BASE` if set, else the merge base of
 * HEAD and `master`, else of HEAD and `origin/master`. Undefined (the gate is
 * skipped) when no base resolves or HEAD is the base, as on master itself.
 * Throws when `$COVERAGE_BASE` is set but names no commit: a typo must not
 * switch the gate off.
 */
export function resolveBase(
  env: Readonly<Record<string, string | undefined>>,
  git: Git,
): string | undefined {
  const requested = env['COVERAGE_BASE'];
  let base: string | undefined;
  if (requested !== undefined && requested !== '') {
    base = gitLine(git, ['rev-parse', '--verify', '--quiet', `${requested}^{commit}`]);
    if (base === undefined) {
      throw new Error(`COVERAGE_BASE=${requested} is not a commit`);
    }
  } else {
    base =
      gitLine(git, ['merge-base', 'HEAD', 'master']) ??
      gitLine(git, ['merge-base', 'HEAD', 'origin/master']);
  }
  if (base === undefined || base === gitLine(git, ['rev-parse', 'HEAD'])) {
    return undefined;
  }
  return base;
}
