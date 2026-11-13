/**
 * Tests for the HTTP `Link` header pagination parser.
 */
import { describe, expect, it } from 'vitest';

import { type PageCursor, type PageLinks, parseLinkHeader } from './pagination';

/** The next and prev cursors of a header, as a pair for easy assertions. */
function cursors(header: string | null): readonly [PageCursor | null, PageCursor | null] {
  const links: PageLinks = parseLinkHeader(header);
  return [links.next, links.prev];
}

const TWO_LINKS =
  '<https://wired.example/api/v1/timelines/home?max_id=109>; rel="next", ' +
  '<https://wired.example/api/v1/timelines/home?min_id=120>; rel="prev"';

describe(parseLinkHeader, () => {
  it('returns no links for a null header', () => {
    expect(cursors(null)).toStrictEqual([null, null]);
  });

  it('returns no links for an empty header', () => {
    expect(cursors('')).toStrictEqual([null, null]);
  });

  it('returns no links for a whitespace-only header', () => {
    expect(cursors('   \t ')).toStrictEqual([null, null]);
  });

  it('reads the next and prev cursors of a two-link header', () => {
    expect(cursors(TWO_LINKS)).toStrictEqual([{ max_id: '109' }, { min_id: '120' }]);
  });

  it('leaves prev null when only next is present', () => {
    expect(cursors('<https://wired.example/home?max_id=109>; rel="next"')).toStrictEqual([
      { max_id: '109' },
      null,
    ]);
  });

  it('accepts an unquoted rel', () => {
    expect(cursors('<https://wired.example/home?max_id=7>; rel=next')).toStrictEqual([
      { max_id: '7' },
      null,
    ]);
  });

  it('collects every query parameter of the link', () => {
    expect(cursors('<https://wired.example/home?max_id=5&limit=20>; rel="next"')).toStrictEqual([
      { max_id: '5', limit: '20' },
      null,
    ]);
  });

  it('keeps the last value of a repeated query parameter', () => {
    expect(cursors('<https://wired.example/home?max_id=1&max_id=2>; rel="prev"')).toStrictEqual([
      null,
      { max_id: '2' },
    ]);
  });

  it('gives a link without query parameters an empty cursor', () => {
    expect(cursors('<https://wired.example/home>; rel="next"')).toStrictEqual([{}, null]);
  });

  it('ignores entries with other rels', () => {
    expect(
      cursors(
        '<https://wired.example/home>; rel="self", ' +
          '<https://wired.example/home?max_id=9>; rel="next"',
      ),
    ).toStrictEqual([{ max_id: '9' }, null]);
  });

  it('ignores an entry without angle brackets but parses its sibling', () => {
    expect(
      cursors('not-a-link, <https://wired.example/home?min_id=120>; rel="prev"'),
    ).toStrictEqual([null, { min_id: '120' }]);
  });

  it('ignores an entry with an unparseable URL but parses its sibling', () => {
    expect(
      cursors('<not a url>; rel="next", <https://wired.example/home?min_id=3>; rel="prev"'),
    ).toStrictEqual([null, { min_id: '3' }]);
  });

  it('ignores an entry whose angle bracket is never closed', () => {
    expect(
      cursors(
        '<https://wired.example/home?max_id=1, <https://wired.example/x?min_id=2>; rel="prev"',
      ),
    ).toStrictEqual([null, { min_id: '2' }]);
  });

  it('ignores a valid link that carries no rel', () => {
    expect(
      cursors('<https://wired.example/home?max_id=9>, <https://ex/y?min_id=1>; rel="prev"'),
    ).toStrictEqual([null, { min_id: '1' }]);
  });

  it('keeps the first entry when a rel appears twice', () => {
    expect(
      cursors(
        '<https://wired.example/home?max_id=1>; rel="next", ' +
          '<https://wired.example/home?max_id=2>; rel="next"',
      ),
    ).toStrictEqual([{ max_id: '1' }, null]);
  });

  it('ignores whitespace around the separators of an entry', () => {
    expect(cursors('<https://wired.example/home?max_id=4 > ;rel = "next"')).toStrictEqual([
      { max_id: '4' },
      null,
    ]);
  });

  it('parses a comma inside a URL query without splitting the entry', () => {
    expect(cursors('<https://wired.example/home?a=1,2&max_id=8>; rel="next"')).toStrictEqual([
      { a: '1,2', max_id: '8' },
      null,
    ]);
  });
});
