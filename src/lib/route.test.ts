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
  ['#/authorize_interaction?uri=ally%40x.example', { kind: 'interact', value: 'ally@x.example' }],
];

/** Interaction hashes whose value reads differently from how they are spelled. */
const INTERACTIONS: readonly (readonly [string, string])[] = [
  ['#/authorize_interaction?uri=acct:ally@x.example', 'ally@x.example'],
  ['#/authorize_interaction?uri=acct%3Aally%40x.example', 'ally@x.example'],
  ['#/authorize_interaction?uri=https://x.example/@ally/1', 'https://x.example/@ally/1'],
  [
    '#/authorize_interaction?uri=https%3A%2F%2Fx.example%2F%40ally%2F1',
    'https://x.example/@ally/1',
  ],
  ['#/authorize_interaction?acct=ally@x.example', 'ally@x.example'],
  ['#/authorize_interaction?acct=acct:ally@x.example', 'ally@x.example'],
  ['#/authorize_interaction?uri=ally@x.example&acct=other@y.example', 'ally@x.example'],
  ['#/authorize_interaction?uri=a+b', 'a+b'],
];

describe(parseRoute, () => {
  it.each(ROUTES)('parses %s', (hash, route) => {
    expect(parseRoute(hash)).toStrictEqual(route);
  });

  it.each(INTERACTIONS)('parses %s as an interaction', (hash, value) => {
    expect(parseRoute(hash)).toStrictEqual({ kind: 'interact', value });
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
    '#/authorize_interaction',
    '#/authorize_interaction?',
    '#/authorize_interaction?uri=',
    '#/authorize_interaction?uri=acct:',
    '#/authorize_interaction?uri',
    '#/authorize_interaction?other=ally@x.example',
    '#/authorize_interaction?uri=%E0%A4%A',
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
