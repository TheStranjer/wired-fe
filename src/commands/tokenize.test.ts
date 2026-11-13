/**
 * Tests for the command-argument tokenizer.
 */
import { describe, expect, it } from 'vitest';

import { tokenize } from './tokenize';
import { err, ok } from '../lib/result';

describe(tokenize, () => {
  it('tokenizes empty and whitespace-only input as no tokens', () => {
    expect(tokenize('')).toStrictEqual(ok([]));
    expect(tokenize('   ')).toStrictEqual(ok([]));
    expect(tokenize(' \t\n ')).toStrictEqual(ok([]));
  });

  it('splits on runs of whitespace', () => {
    expect(tokenize('a b  c')).toStrictEqual(ok(['a', 'b', 'c']));
    expect(tokenize('  leading and trailing  ')).toStrictEqual(ok(['leading', 'and', 'trailing']));
  });

  it('keeps whitespace inside quotes in one token', () => {
    expect(tokenize('"hello world" x')).toStrictEqual(ok(['hello world', 'x']));
    expect(tokenize('"spoilers for lain" text')).toStrictEqual(ok(['spoilers for lain', 'text']));
  });

  it('joins quoted sections with adjacent plain characters', () => {
    expect(tokenize('a"b c"d')).toStrictEqual(ok(['ab cd']));
    expect(tokenize('"a""b"')).toStrictEqual(ok(['ab']));
  });

  it('unescapes \\" and \\\\ inside quotes only', () => {
    expect(tokenize('"say \\"hi\\""')).toStrictEqual(ok(['say "hi"']));
    expect(tokenize('"back\\\\slash"')).toStrictEqual(ok(['back\\slash']));
  });

  it('keeps any other backslash inside quotes as-is', () => {
    expect(tokenize('"a\\nb"')).toStrictEqual(ok(['a\\nb']));
  });

  it('treats backslashes outside quotes as literal', () => {
    expect(tokenize('C:\\tmp')).toStrictEqual(ok(['C:\\tmp']));
    expect(tokenize('a\\"b')).toStrictEqual(err({ kind: 'unterminated-quote', position: 2 }));
  });

  it('produces an empty-string token for ""', () => {
    expect(tokenize('x "" y')).toStrictEqual(ok(['x', '', 'y']));
    expect(tokenize('""')).toStrictEqual(ok(['']));
  });

  it('reports an unterminated quote at the index of the opening quote', () => {
    expect(tokenize('ok "unterminated')).toStrictEqual(
      err({ kind: 'unterminated-quote', position: 3 }),
    );
    expect(tokenize('"x')).toStrictEqual(err({ kind: 'unterminated-quote', position: 0 }));
    expect(tokenize('"a" b"c')).toStrictEqual(err({ kind: 'unterminated-quote', position: 5 }));
  });

  it('does not close a quote with an escaped backslash before it', () => {
    expect(tokenize('"a\\"')).toStrictEqual(err({ kind: 'unterminated-quote', position: 0 }));
    expect(tokenize('"a\\\\"')).toStrictEqual(ok(['a\\']));
  });
});
