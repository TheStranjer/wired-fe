/**
 * Tests for the string tests behind `wired/no-literal-user-text`: what is a
 * word, a key chord, command syntax, and an allowlisted literal.
 */
import { describe, expect, it } from 'vitest';

import { hasWord, isAllowlisted, isCommandSyntax, isKeyChord } from './userText.ts';

describe(hasWord, () => {
  it.each(['Hello', '[ send ]', 'Ctrl+B', '日本', 'x1y2 ab'])('finds a word in %j', (text) => {
    expect(hasWord(text)).toBe(true);
  });

  it.each(['', '⇲', '✕', '[x]', '[ ] ', ': ', 'a4', '1 2 3', ' - '])('finds none in %j', (text) => {
    expect(hasWord(text)).toBe(false);
  });
});

describe(isKeyChord, () => {
  it.each(['Ctrl+B', 'Ctrl+B %', 'Alt+Shift+K', 'Ctrl+B Ctrl+C', 'Meta+Enter', 'Ctrl++'])(
    'takes %j for a chord',
    (text) => {
      expect(isKeyChord(text)).toBe(true);
    },
  );

  it.each(['Ctrl', 'Ctrl+B and more', 'Hello there', 'B %', '', 'Ctrl+'])(
    'does not take %j for a chord',
    (text) => {
      expect(isKeyChord(text)).toBe(false);
    },
  );
});

describe(isCommandSyntax, () => {
  it.each([
    '/about',
    '/dm <actor> <text>',
    '/win <number>',
    '/float size <w> <h>',
    '/feed [view] [<a>|<b>]',
    '/win move|size',
    '/dm ... | /as',
    '/a [[b] c]',
    '/a  <x>   [y]',
    '/foo |',
  ])('takes %j for command syntax', (text) => {
    expect(isCommandSyntax(text)).toBe(true);
  });

  it.each([
    '',
    'about',
    'Use it like this',
    '/Foo',
    '/foo bar baz qux',
    '/foo bar|baz|qux',
    '/foo Bar',
    '/foo ||',
  ])('does not take %j for command syntax', (text) => {
    expect(isCommandSyntax(text)).toBe(false);
  });
});

describe(isAllowlisted, () => {
  it('excuses an entry in its own file, on any checkout path', () => {
    expect(isAllowlisted('/home/me/wired-fe/src/app/App.tsx', 'WIRED')).toBe(true);
    expect(isAllowlisted('src/app/App.tsx', 'WIRED')).toBe(true);
    expect(isAllowlisted('C:\\work\\wired-fe\\src\\app\\App.tsx', 'WIRED')).toBe(true);
  });

  it('does not excuse the same text in another file, or other text in that file', () => {
    expect(isAllowlisted('/x/src/app/Other.tsx', 'WIRED')).toBe(false);
    expect(isAllowlisted('/x/src/app/App.tsx', 'WIRED!')).toBe(false);
    expect(isAllowlisted('/x/not-src/app/App.tsx', 'WIRED')).toBe(false);
  });
});
