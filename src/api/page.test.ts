/**
 * Tests for the page helpers: `pageQuery` builds query parameters from a
 * cursor and limit, and `toPage` wraps a list response with the cursors
 * parsed from its `Link` header.
 */
import { describe, expect, it } from 'vitest';

import { type Page, pageQuery, toPage } from './page';
import type { ApiResponse } from './response';

const TWO_LINKS =
  '<https://wired.example/api/v1/timelines/home?max_id=109>; rel="next", ' +
  '<https://wired.example/api/v1/timelines/home?min_id=120>; rel="prev"';

describe(pageQuery, () => {
  it('returns no parameters when the request is undefined', () => {
    expect(pageQuery(undefined)).toStrictEqual({});
  });

  it('returns no parameters for an empty request', () => {
    expect(pageQuery({})).toStrictEqual({});
  });

  it('copies the cursor parameters', () => {
    expect(pageQuery({ cursor: { max_id: '109' } })).toStrictEqual({ max_id: '109' });
  });

  it('adds the limit on its own', () => {
    expect(pageQuery({ limit: 20 })).toStrictEqual({ limit: 20 });
  });

  it('combines the cursor parameters with the limit', () => {
    expect(pageQuery({ cursor: { max_id: '109' }, limit: 20 })).toStrictEqual({
      max_id: '109',
      limit: 20,
    });
  });

  it('lets an explicit limit override the cursor one', () => {
    expect(pageQuery({ cursor: { max_id: '109', limit: '40' }, limit: 20 })).toStrictEqual({
      max_id: '109',
      limit: 20,
    });
  });
});

describe(toPage, () => {
  it('pairs the items with the cursors of the Link header', () => {
    const response: ApiResponse<readonly string[]> = { data: ['a', 'b'], link: TWO_LINKS };
    const page: Page<string> = toPage(response);

    expect(page).toStrictEqual({
      items: ['a', 'b'],
      links: { next: { max_id: '109' }, prev: { min_id: '120' } },
    });
  });

  it('gives a response without a Link header no cursors', () => {
    const response: ApiResponse<readonly number[]> = { data: [1, 2, 3], link: null };

    expect(toPage(response)).toStrictEqual({
      items: [1, 2, 3],
      links: { next: null, prev: null },
    });
  });
});
