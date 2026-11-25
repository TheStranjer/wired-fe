/**
 * The ban on coverage-ignore comments: `v8 ignore`, `c8 ignore` and
 * `istanbul ignore` hide code from coverage, so none may appear in `src/`.
 */
import type { Offender } from './offender.ts';

/** A coverage-ignore directive, as any of the three tools spells it. */
const IGNORE_COMMENT = /\b(?:v8|c8|istanbul)\s+ignore\b/u;

/** One source file: its repository-relative path and its text. */
type SourceFile = { readonly path: string; readonly text: string };

/** One offender per line of the given files that holds a coverage-ignore directive. */
export function findIgnoreComments(files: readonly SourceFile[]): readonly Offender[] {
  return files.flatMap(({ path, text }) =>
    text
      .split('\n')
      .flatMap((content, index) =>
        IGNORE_COMMENT.test(content)
          ? [{ file: path, line: index + 1, message: 'coverage-ignore comment is banned' }]
          : [],
      ),
  );
}
