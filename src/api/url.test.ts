/**
 * Unit tests for buildUrl: joining origin and path, and the query rules —
 * skipped undefined values, stringified scalars, Mastodon-style array keys.
 */
import { describe, expect, it } from 'vitest';

import { type QueryValue, buildUrl } from './url';

const ORIGIN = 'https://wired.example';
const PATH = '/api/v1/timelines/home';

/** The query of buildUrl's result, parsed back for inspection. */
function queryOf(query: Record<string, QueryValue>): URLSearchParams {
  return new URL(buildUrl(ORIGIN, PATH, query)).searchParams;
}

describe(buildUrl, () => {
  it('joins origin and path and adds nothing without a query', () => {
    expect(buildUrl(ORIGIN, PATH, undefined)).toBe('https://wired.example/api/v1/timelines/home');
  });

  it('stringifies numbers and booleans', () => {
    const params = queryOf({ limit: 20, full: true, hidden: false });

    expect(params.get('limit')).toBe('20');
    expect(params.get('full')).toBe('true');
    expect(params.get('hidden')).toBe('false');
  });

  it('keeps strings as they are', () => {
    expect(queryOf({ q: 'serial experiments' }).get('q')).toBe('serial experiments');
  });

  it('skips undefined values', () => {
    const params = queryOf({ keep: 'x', drop: undefined });

    expect(params.get('keep')).toBe('x');
    expect(params.has('drop')).toBe(false);
  });

  it('adds one key[]=value pair per array element', () => {
    const params = queryOf({ tag: ['lain', 'wired'] });

    expect(params.getAll('tag[]')).toStrictEqual(['lain', 'wired']);
    expect(params.has('tag')).toBe(false);
  });

  it('leaves an empty array out of the query', () => {
    expect(queryOf({ tag: [] }).has('tag[]')).toBe(false);
  });
});
