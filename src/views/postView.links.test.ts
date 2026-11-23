/**
 * Tests for the links postView builds (WFE-156): the mention and tag links in
 * a post's body that the app opens itself, by the href each is written as,
 * taken from the displayed status — the original, for a boost.
 */

import { describe, expect, it } from 'vitest';

import { postView } from './postView';
import { status } from '../test/fixtures';

const SIGNED_OUT = { origin: 'https://wired.example', accountId: null };

/** The keys of the links map of a post carrying these extras. */
function linkKeys(extras: Record<string, unknown>): string[] {
  return [...postView(status('1', extras), SIGNED_OUT).links.keys()];
}

describe('postView links', () => {
  it('maps a mention to a profile link under its url', () => {
    const post = status('1', {
      mentions: [
        { id: 'a9', username: 'ally', acct: 'ally', url: 'https://wired.example/users/ally' },
      ],
    });

    expect(postView(post, SIGNED_OUT).links).toStrictEqual(
      new Map([
        ['https://wired.example/users/ally', { kind: 'profile', accountId: 'a9', acct: 'ally' }],
      ]),
    );
  });

  it('maps a tag under its url and both path spellings with the lowercase name', () => {
    const post = status('1', { tags: [{ name: 'Rust', url: 'https://wired.example/tags/Rust' }] });
    const links = postView(post, SIGNED_OUT).links;

    expect([...links.keys()]).toStrictEqual([
      'https://wired.example/tags/Rust',
      'https://wired.example/tags/rust',
      'https://wired.example/tag/rust',
    ]);
    expect(links.get('https://wired.example/tag/rust')).toStrictEqual({
      kind: 'tag',
      name: 'rust',
    });
  });

  it('spells a tag of a server that writes /tag/ under that same origin', () => {
    expect(
      linkKeys({ tags: [{ name: 'Rust', url: 'https://pleroma.example/tag/Rust' }] }),
    ).toStrictEqual([
      'https://pleroma.example/tag/Rust',
      'https://pleroma.example/tags/rust',
      'https://pleroma.example/tag/rust',
    ]);
  });

  it('maps a post without mentions or tags to no links', () => {
    expect(linkKeys({})).toStrictEqual([]);
  });

  it('takes the links of the boosted original, not of the boost', () => {
    const original = status('orig', {
      tags: [{ name: 'lain', url: 'https://wired.example/tags/lain' }],
    });
    const boost = status('boost', { reblog: original });

    expect(postView(boost, SIGNED_OUT).links.has('https://wired.example/tags/lain')).toBe(true);
  });
});
