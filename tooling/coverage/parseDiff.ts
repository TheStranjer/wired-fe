/**
 * Parsing of `git diff -U0` output into the lines each checked file added or
 * changed, for the diff-coverage gate. Pure: text in, line sets out.
 */

/** Changed (added or modified) line numbers per repository-relative path. */
export type ChangedLines = ReadonlyMap<string, ReadonlySet<number>>;

/** `@@ -oldStart[,oldCount] +newStart[,newCount] @@`; a missing count means 1. */
const HUNK_HEADER = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u;

/** Where the parser is: the current file and how much of the current hunk is left. */
type Cursor = {
  readonly file: string | undefined;
  readonly oldLeft: number;
  readonly newLeft: number;
  readonly nextLine: number;
};

/** Receives one changed line of one file. */
type Recorder = (file: string, line: number) => void;

/**
 * True for the files the gate checks: `.ts`/`.tsx` under `src/`, minus tests,
 * `src/test/` and `src/app/main.tsx` (the same excludes as the coverage config).
 */
export function isCheckedFile(path: string): boolean {
  if (!path.startsWith('src/') || !/\.tsx?$/u.test(path)) {
    return false;
  }
  return (
    !/\.test\.tsx?$/u.test(path) && !path.startsWith('src/test/') && path !== 'src/app/main.tsx'
  );
}

/** The path of a `+++ ` header line, or undefined for `/dev/null` (a deletion). */
function headerPath(line: string): string | undefined {
  const path = line.slice('+++ '.length);
  if (path === '/dev/null') {
    return undefined;
  }
  return path.startsWith('b/') ? path.slice(2) : path;
}

/** Counts a number captured by the hunk regex, 1 when it was left out. */
function count(text: string | undefined): number {
  return text === undefined ? 1 : Number(text);
}

/** Moves the cursor over one line of a hunk body, recording added lines. */
function hunkLine(cursor: Cursor, line: string, record: Recorder): Cursor {
  if (line.startsWith('-')) {
    return { ...cursor, oldLeft: cursor.oldLeft - 1 };
  }
  if (line.startsWith('+')) {
    if (cursor.file !== undefined) {
      record(cursor.file, cursor.nextLine);
    }
    return { ...cursor, newLeft: cursor.newLeft - 1, nextLine: cursor.nextLine + 1 };
  }
  if (line.startsWith(' ')) {
    return {
      ...cursor,
      oldLeft: cursor.oldLeft - 1,
      newLeft: cursor.newLeft - 1,
      nextLine: cursor.nextLine + 1,
    };
  }
  return cursor;
}

/** Moves the cursor over one line outside a hunk body: a file or hunk header. */
function headerLine(cursor: Cursor, line: string): Cursor {
  const hunk = HUNK_HEADER.exec(line);
  if (hunk !== null) {
    return {
      ...cursor,
      oldLeft: count(hunk[1]),
      newLeft: count(hunk[3]),
      nextLine: Number(hunk[2]),
    };
  }
  return line.startsWith('+++ ') ? { ...cursor, file: headerPath(line) } : cursor;
}

/**
 * The added and changed lines of every checked file in a `git diff -U0`
 * output. A hunk's own line counts say where its body ends, so an added line
 * that happens to read `++ x` is never mistaken for a file header. Deleted
 * lines and deleted files contribute nothing.
 */
export function parseChangedLines(diff: string): ChangedLines {
  const result = new Map<string, Set<number>>();
  const record: Recorder = (file, line) => {
    if (isCheckedFile(file)) {
      const lines = result.get(file) ?? new Set<number>();
      lines.add(line);
      result.set(file, lines);
    }
  };
  let cursor: Cursor = { file: undefined, oldLeft: 0, newLeft: 0, nextLine: 0 };
  for (const line of diff.split('\n')) {
    const inHunk = cursor.oldLeft > 0 || cursor.newLeft > 0;
    cursor = inHunk ? hunkLine(cursor, line, record) : headerLine(cursor, line);
  }
  return result;
}
