/**
 * Tests for the hash routes (decision 4): every route parses and formats
 * back to the same hash, percent-escapes decode and encode, and junk, an
 * empty hash, a missing id, extra segments and malformed escapes are no route
 * at all.
 */
import { describe, expect, it } from 'vitest';

import { type Route, formatRoute, parseRoute } from './route';

/** Every kind of route, the hash that spells it and the route it parses to. */
const ROUTES: readonly (readonly [string, Route])[] = [
  ['#/notice/abc', { kind: 'notice', value: 'abc' }],
  ['#/@lain', { kind: 'acct', value: 'lain' }],
  ['#/@lain@wired.example', { kind: 'acct', value: 'lain@wired.example' }],
  ['#/users/109', { kind: 'user', value: '109' }],
  ['#/tag/Rust', { kind: 'tag', value: 'Rust' }],
];

describe(parseRoute, () => {
  it.each(ROUTES)('parses %s', (hash, route) => {
    expect(parseRoute(hash)).toStrictEqual(route);
  });

  it('decodes percent-escaped characters', () => {
    expect(parseRoute('#/notice/a%20b%2Fc')).toStrictEqual({ kind: 'notice', value: 'a b/c' });
    expect(parseRoute('#/@lain%40wired.example')).toStrictEqual({
      kind: 'acct',
      value: 'lain@wired.example',
    });
    expect(parseRoute('#/tag/%C3%A9t%C3%A9')).toStrictEqual({ kind: 'tag', value: 'été' });
  });

  it.each([
    '',
    '#',
    '#/',
    '#//',
    'notice/abc',
    '#notice/abc',
    '#/junk',
    '#/junk/abc',
    '#/notice',
    '#/notice/',
    '#/notice//',
    '#/notice/abc/extra',
    '#/notice/abc/',
    '#/@',
    '#/@lain/extra',
    '#/users/',
    '#/users/1/2',
    '#/tag/',
    '#/interact/abc',
    '#/notice/%E0%A4%A',
    '#/%E0%A4%A/abc',
    '#/registration/abc',
  ])('is no route: %j', (hash) => {
    expect(parseRoute(hash)).toBeNull();
  });
});

describe(formatRoute, () => {
  it.each(ROUTES)('spells %s', (hash, route) => {
    expect(formatRoute(route)).toBe(hash);
  });

  it('percent-encodes every segment', () => {
    expect(formatRoute({ kind: 'notice', value: 'a b/c' })).toBe('#/notice/a%20b%2Fc');
    expect(formatRoute({ kind: 'acct', value: 'é@wired.example' })).toBe('#/@%C3%A9@wired.example');
  });

  it.each(ROUTES)('round-trips %s', (_hash, route) => {
    expect(parseRoute(formatRoute(route))).toStrictEqual(route);
  });
});
