/**
 * Tests for the qualified hash routes (decision 4): `#/<host>/notice/<id>`,
 * `#/<host>/users/<id>` and `#/<host>/tag/<name>` parse to a route carrying
 * the instance origin and format back to the same hash; a segment that is not
 * a host, an empty id, an extra segment and the box routes are no qualified
 * route, and the short forms are untouched.
 */
import { describe, expect, it } from 'vitest';

import { type Route, formatRoute, parseRoute, routeOrigin } from './route';

/** Every kind of qualified route, the hash that spells it and the route it parses to. */
const QUALIFIED: readonly (readonly [string, Route])[] = [
  ['#/wired.example/notice/abc', { kind: 'notice', value: 'abc', origin: 'https://wired.example' }],
  ['#/wired.example/users/109', { kind: 'user', value: '109', origin: 'https://wired.example' }],
  ['#/wired.example/tag/Rust', { kind: 'tag', value: 'Rust', origin: 'https://wired.example' }],
  [
    '#/wired.example:8443/notice/7',
    { kind: 'notice', value: '7', origin: 'https://wired.example:8443' },
  ],
  ['#/localhost:4000/notice/7', { kind: 'notice', value: '7', origin: 'http://localhost:4000' }],
  ['#/localhost:4000/users/3', { kind: 'user', value: '3', origin: 'http://localhost:4000' }],
  ['#/localhost/tag/rust', { kind: 'tag', value: 'rust', origin: 'http://localhost' }],
  ['#/127.0.0.1:8080/notice/7', { kind: 'notice', value: '7', origin: 'http://127.0.0.1:8080' }],
  [
    '#/wired.example/tag/%C3%A9t%C3%A9',
    { kind: 'tag', value: 'été', origin: 'https://wired.example' },
  ],
  [
    '#/wired.example/notice/a%20b%2Fc',
    { kind: 'notice', value: 'a b/c', origin: 'https://wired.example' },
  ],
];

describe('qualified routes', () => {
  it.each(QUALIFIED)('parses %s', (hash, route) => {
    expect(parseRoute(hash)).toStrictEqual(route);
  });

  it.each(QUALIFIED)('spells %s', (hash, route) => {
    expect(formatRoute(route)).toBe(hash);
  });

  it.each(QUALIFIED)('round-trips %s', (_hash, route) => {
    expect(parseRoute(formatRoute(route))).toStrictEqual(route);
  });

  it.each([
    '#/wired/notice/abc',
    '#/notice/notice/abc',
    '#/tag/tag/abc',
    '#/users/users/1',
    '#/registration/notice/abc',
    '#/localhost:/notice/abc',
    '#/wired.example:99999/notice/abc',
    '#/wired.example/notice/',
    '#/wired.example/notice',
    '#/wired.example/notice/abc/extra',
    '#/wired.example/notice/abc/',
    '#/wired.example/junk/abc',
    '#/wired.example/@lain',
    '#/wired.example/tag/%E0%A4%A',
    '#/@wired.example/notice/abc',
    '#//notice/abc',
  ])('is no route: %j', (hash) => {
    expect(parseRoute(hash)).toBeNull();
  });

  it.each([
    '#/registration/abc',
    '#/password_reset/abc',
    '#/oauth/authorize?client_id=x',
    '#/oauth/external/register?state=x',
    '#/authorize_interaction?uri=ally@x.example',
  ])('does not read the box route %s as qualified', (hash) => {
    expect(routeOrigin(parseRoute(hash) ?? { kind: 'acct', value: 'none' })).toBeUndefined();
  });

  it('leaves the short forms short', () => {
    expect(parseRoute('#/notice/abc')).toStrictEqual({ kind: 'notice', value: 'abc' });
    expect(parseRoute('#/@lain@wired.example')).toStrictEqual({
      kind: 'acct',
      value: 'lain@wired.example',
    });
  });
});

describe(routeOrigin, () => {
  it('answers the origin of a qualified route', () => {
    expect(routeOrigin({ kind: 'tag', value: 'a', origin: 'https://wired.example' })).toBe(
      'https://wired.example',
    );
  });

  it('answers undefined for a short route and for an account', () => {
    expect(routeOrigin({ kind: 'notice', value: 'a' })).toBeUndefined();
    expect(routeOrigin({ kind: 'acct', value: 'a' })).toBeUndefined();
  });
});
