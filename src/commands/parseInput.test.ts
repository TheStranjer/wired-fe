/**
 * Tests for the command-line input classifier.
 */
import { describe, expect, it } from 'vitest';

import { parseInput } from './parseInput';

describe(parseInput, () => {
  it('classifies blank input as empty', () => {
    expect(parseInput('')).toStrictEqual({ kind: 'empty' });
    expect(parseInput('   ')).toStrictEqual({ kind: 'empty' });
  });

  it('returns plain text as typed, spaces included', () => {
    expect(parseInput('hello world')).toStrictEqual({ kind: 'text', text: 'hello world' });
    expect(parseInput('  padded  ')).toStrictEqual({ kind: 'text', text: '  padded  ' });
  });

  it('turns //text into the literal /text', () => {
    expect(parseInput('//etc/passwd is a path')).toStrictEqual({
      kind: 'text',
      text: '/etc/passwd is a path',
    });
  });

  it('parses a bare command with no arguments', () => {
    expect(parseInput('/help')).toStrictEqual({ kind: 'command', name: 'help', rest: '' });
  });

  it('lowercases the name and keeps the rest verbatim', () => {
    expect(parseInput('/DM @a@b.example hey there')).toStrictEqual({
      kind: 'command',
      name: 'dm',
      rest: '@a@b.example hey there',
    });
  });

  it('strips leading whitespace from the rest', () => {
    expect(parseInput('/fav    a3')).toStrictEqual({ kind: 'command', name: 'fav', rest: 'a3' });
  });

  it('accepts hyphenated command names', () => {
    expect(parseInput('/win-move 3')).toStrictEqual({
      kind: 'command',
      name: 'win-move',
      rest: '3',
    });
  });

  it('rejects a slash with no command name', () => {
    expect(parseInput('/')).toStrictEqual({
      kind: 'invalid',
      reason: 'Missing command name after /',
    });
    expect(parseInput('/  x')).toStrictEqual({
      kind: 'invalid',
      reason: 'Missing command name after /',
    });
  });

  it('rejects names that do not match the pattern, quoting them as typed', () => {
    expect(parseInput('/9lives')).toStrictEqual({
      kind: 'invalid',
      reason: 'Invalid command name: /9lives',
    });
    expect(parseInput('/fa$v')).toStrictEqual({
      kind: 'invalid',
      reason: 'Invalid command name: /fa$v',
    });
  });
});
