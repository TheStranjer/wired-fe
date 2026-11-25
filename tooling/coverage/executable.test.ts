/** Tests for telling files that run code from files of types and comments. */
import { describe, expect, it } from 'vitest';

import { hasExecutableCode } from './executable';

describe(hasExecutableCode, () => {
  it.each([
    'export type A = { readonly b: number };\n',
    "import type { A } from './a';\nexport type { A };\nexport type B = A;\n",
    '/** Only a comment. */\n// and another\n',
    'export type Fn = (x: number) => string; // trailing\n',
    '',
    'export {};\n',
  ])('finds nothing to run in %j', (source) => {
    expect(hasExecutableCode(source)).toBe(false);
  });

  it.each([
    'export const A = 1;\n',
    'export function f(): void {}\n',
    "export * from './a';\n",
    "import { a } from './a';\nexport type B = typeof a;\n",
  ])('finds code in %j', (source) => {
    expect(hasExecutableCode(source)).toBe(true);
  });

  it('counts source with syntax type stripping cannot handle as executable', () => {
    expect(hasExecutableCode('export const A = <b>hi</b>;\n')).toBe(true);
  });
});
