/**
 * Tests for the formatter helpers: parsing a message, and the comparison of
 * the argument names of two messages through plural, select and tag branches.
 */
import { describe, expect, it } from 'vitest';

import { parseMessage, sameArguments } from './formatters';

/** The formatter of {@link message}; the test fails when it does not parse. */
function parsed(message: string): NonNullable<ReturnType<typeof parseMessage>> {
  const formatter = parseMessage(message, 'en');
  if (formatter === null) {
    throw new Error(`does not parse: ${message}`);
  }
  return formatter;
}

describe(parseMessage, () => {
  it('parses a message and answers null for one that does not parse', () => {
    expect(parseMessage('Hello {name}', 'en')).not.toBeNull();
    expect(parseMessage('Hello {name', 'en')).toBeNull();
  });
});

describe(sameArguments, () => {
  it('ignores the text and the order around the arguments', () => {
    expect(sameArguments(parsed('a {x} b {y}'), parsed('{y} und {x}'))).toBe(true);
  });

  it('sees the arguments inside plural and select branches and tags', () => {
    const source = parsed(
      '{n, plural, one {# {thing}} other {{n} {thing}s}} {k, select, a {<b>{w}</b>} other {z}}',
    );

    expect(
      sameArguments(
        source,
        parsed('{n, plural, other {{thing} # {w}}} {k, select, other {<b>{w}</b>}}'),
      ),
    ).toBe(true);
    expect(
      sameArguments(source, parsed('{n, plural, other {{thing}}} {k, select, other {x}}')),
    ).toBe(false);
  });

  it('tells messages with other arguments, or another number of them, apart', () => {
    expect(sameArguments(parsed('{a}'), parsed('{b}'))).toBe(false);
    expect(sameArguments(parsed('{a}'), parsed('{a} {b}'))).toBe(false);
    expect(sameArguments(parsed('plain'), parsed('also plain'))).toBe(true);
  });
});
