/**
 * Tests for reading `git diff -U0` output into changed line sets and for the
 * choice of which files the gate checks.
 */
import { describe, expect, it } from 'vitest';

import { isCheckedFile, parseChangedLines } from './parseDiff';

/** A diff of one file: its `+++` header followed by the given hunk text. */
function fileDiff(path: string, hunks: string): string {
  return `diff --git a/${path} b/${path}\nindex 111..222 100644\n--- a/${path}\n+++ b/${path}\n${hunks}`;
}

describe(isCheckedFile, () => {
  it.each(['src/a.ts', 'src/lib/b.ts', 'src/ui/C.tsx', 'src/app/App.tsx'])('checks %s', (path) => {
    expect(isCheckedFile(path)).toBe(true);
  });

  it.each([
    'src/a.test.ts',
    'src/ui/C.test.tsx',
    'src/test/setup.ts',
    'src/test/helpers/x.ts',
    'src/app/main.tsx',
    'src/theme/tokens.css',
    'tooling/csp.ts',
    'e2e/app.ts',
    'a.ts',
    'src/a.tsx.bak',
  ])('skips %s', (path) => {
    expect(isCheckedFile(path)).toBe(false);
  });
});

describe(parseChangedLines, () => {
  it('reads a single added line, whose count is left out', () => {
    const diff = fileDiff('src/a.ts', '@@ -4,0 +5 @@\n+const x = 1;\n');

    expect(parseChangedLines(diff)).toStrictEqual(new Map([['src/a.ts', new Set([5])]]));
  });

  it('reads an added range', () => {
    const diff = fileDiff('src/a.ts', '@@ -4,0 +5,3 @@\n+a\n+b\n+c\n');

    expect(parseChangedLines(diff)).toStrictEqual(new Map([['src/a.ts', new Set([5, 6, 7])]]));
  });

  it('counts the new side of a replacement and ignores the removed lines', () => {
    const diff = fileDiff(
      'src/a.ts',
      '@@ -10,2 +10,2 @@\n-old one\n-old two\n+new one\n+new two\n',
    );

    expect(parseChangedLines(diff)).toStrictEqual(new Map([['src/a.ts', new Set([10, 11])]]));
  });

  it('records nothing for a pure deletion', () => {
    const diff = fileDiff('src/a.ts', '@@ -7,2 +6,0 @@\n-gone\n-gone too\n');

    expect(parseChangedLines(diff)).toStrictEqual(new Map());
  });

  it('collects several hunks and several files', () => {
    const diff =
      fileDiff('src/a.ts', '@@ -1 +1 @@\n-x\n+y\n@@ -9,0 +10,2 @@\n+p\n+q\n') +
      fileDiff('src/ui/B.tsx', '@@ -3,0 +4 @@\n+z\n');

    expect(parseChangedLines(diff)).toStrictEqual(
      new Map([
        ['src/a.ts', new Set([1, 10, 11])],
        ['src/ui/B.tsx', new Set([4])],
      ]),
    );
  });

  it('skips files the gate does not check', () => {
    const diff =
      fileDiff('src/a.test.ts', '@@ -1 +1 @@\n-x\n+y\n') +
      fileDiff('src/app/main.tsx', '@@ -1 +1 @@\n-x\n+y\n') +
      fileDiff('src/test/setup.ts', '@@ -1 +1 @@\n-x\n+y\n');

    expect(parseChangedLines(diff)).toStrictEqual(new Map());
  });

  it('skips a deleted file', () => {
    const diff =
      'diff --git a/src/a.ts b/src/a.ts\ndeleted file mode 100644\n--- a/src/a.ts\n+++ /dev/null\n@@ -1,2 +0,0 @@\n-a\n-b\n';

    expect(parseChangedLines(diff)).toStrictEqual(new Map());
  });

  it('does not take an added line that reads like a file header for one', () => {
    const diff = fileDiff('src/a.ts', '@@ -1 +1,2 @@\n+++ not a header\n+second\n');

    expect(parseChangedLines(diff)).toStrictEqual(new Map([['src/a.ts', new Set([1, 2])]]));
  });

  it('ignores the no-newline marker inside a hunk', () => {
    const diff = fileDiff('src/a.ts', '@@ -1 +1 @@\n-x\n\\ No newline at end of file\n+y\n');

    expect(parseChangedLines(diff)).toStrictEqual(new Map([['src/a.ts', new Set([1])]]));
  });

  it('keeps counting through context lines, should git print any', () => {
    const diff = fileDiff('src/a.ts', '@@ -1,3 +1,3 @@\n keep\n-x\n+y\n keep\n');

    expect(parseChangedLines(diff)).toStrictEqual(new Map([['src/a.ts', new Set([2])]]));
  });

  it('reads a path without the b/ prefix', () => {
    const diff = '--- src/a.ts\n+++ src/a.ts\n@@ -0,0 +1 @@\n+x\n';

    expect(parseChangedLines(diff)).toStrictEqual(new Map([['src/a.ts', new Set([1])]]));
  });

  it('records nothing for an empty diff', () => {
    expect(parseChangedLines('')).toStrictEqual(new Map());
  });
});
