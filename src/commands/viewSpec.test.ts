/**
 * Tests for the view spec parser (decisions 12 and 13): every form of spec
 * names the command that opens its window or the window it shows, and every
 * malformed one says what was wrong.
 */
import { describe, expect, it } from 'vitest';

import { VIEW_WORDS, parseViewSpec } from './viewSpec';

describe(parseViewSpec, () => {
  it.each([
    ['home', 'home', ''],
    ['local', 'local', ''],
    ['federated', 'federated', ''],
    ['notifications', 'notifications', ''],
    ['composer', 'composer', ''],
    ['tag rust', 'tag', 'rust'],
    ['tag #rust', 'tag', '#rust'],
    ['search lain iwakura', 'search', 'lain iwakura'],
    ['whois @lain@wired.example', 'whois', '@lain@wired.example'],
    ['profile @lain@wired.example', 'whois', '@lain@wired.example'],
    ['whois', 'whois', ''],
    ['profile', 'whois', ''],
    ['dm @lain@wired.example', 'query', '@lain@wired.example'],
    ['thread a3', 'thread', 'a3'],
    ['thread', 'thread', ''],
    ['feed main', 'feed', 'open main'],
    ['FEED ~main', 'feed', 'open ~main'],
  ])('reads %j as the %s command with %j', (text, command, args) => {
    expect(parseViewSpec(text)).toStrictEqual({
      ok: true,
      value: { type: 'open', command, args },
    });
  });

  it('reads win N as the existing window numbered N', () => {
    expect(parseViewSpec('win 3')).toStrictEqual({
      ok: true,
      value: { type: 'window', number: 3 },
    });
  });

  it('ignores the case of the view word and the spacing around the words', () => {
    expect(parseViewSpec('  TAG   Rust  ')).toStrictEqual({
      ok: true,
      value: { type: 'open', command: 'tag', args: 'Rust' },
    });
  });

  it.each([
    ['', 'Unknown view: '],
    ['frobnicate', 'Unknown view: frobnicate'],
    ['home now', 'home takes no argument'],
    ['composer 2', 'composer takes no argument'],
    ['tag', 'tag needs an argument'],
    ['search', 'search needs an argument'],
    ['dm', 'dm needs an argument'],
    ['feed', 'feed needs an argument'],
    ['win', 'win takes a window number'],
    ['win 0', 'win takes a window number'],
    ['win two', 'win takes a window number'],
    ['win 2 3', 'win takes a window number'],
  ])('refuses %j saying %j', (text, error) => {
    expect(parseViewSpec(text)).toStrictEqual({ ok: false, error });
  });

  it('lists every view word, win last', () => {
    expect(VIEW_WORDS).toContain('tag');
    expect(VIEW_WORDS.at(-1)).toBe('win');
  });
});
