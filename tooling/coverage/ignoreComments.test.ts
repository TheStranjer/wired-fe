/** Tests for the scan that bans coverage-ignore comments. */
import { describe, expect, it } from 'vitest';

import { findIgnoreComments } from './ignoreComments';

describe(findIgnoreComments, () => {
  it.each([
    '/* v8 ignore next */',
    '/* v8 ignore start */',
    '// v8 ignore next 3',
    '/* c8 ignore next */',
    '/* istanbul ignore else */',
    '/*istanbul   ignore next*/',
  ])('flags %s', (comment) => {
    const files = [{ path: 'src/a.ts', text: `const a = 1;\n${comment}\nconst b = 2;\n` }];

    expect(findIgnoreComments(files)).toStrictEqual([
      { file: 'src/a.ts', line: 2, message: 'coverage-ignore comment is banned' },
    ]);
  });

  it.each([
    '// ignore this',
    '// v8 coverage is on',
    '// the istanbul reporter',
    '// myv8 ignored',
  ])('leaves %s alone', (comment) => {
    expect(findIgnoreComments([{ path: 'src/a.ts', text: `${comment}\n` }])).toStrictEqual([]);
  });

  it('reports every offending line of every file', () => {
    const files = [
      { path: 'src/a.ts', text: '// c8 ignore next\nok\n// v8 ignore next\n' },
      { path: 'src/ui/B.tsx', text: 'ok\n// istanbul ignore next\n' },
      { path: 'src/c.ts', text: 'clean\n' },
    ];

    expect(
      findIgnoreComments(files).map(({ file, line }) => `${file}:${String(line)}`),
    ).toStrictEqual(['src/a.ts:1', 'src/a.ts:3', 'src/ui/B.tsx:2']);
  });

  it('has nothing to say about no files', () => {
    expect(findIgnoreComments([])).toStrictEqual([]);
  });
});
