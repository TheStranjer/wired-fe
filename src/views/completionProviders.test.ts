/**
 * Tests for the handle provider: every account any buffer showed — authors,
 * boosters, quoted and quoted-from accounts, mentions and notification
 * accounts — plus the signed-in ones, matching the typed word without case,
 * deduplicated, sorted and capped at fifty. Tags and emoji have their own
 * files; ./completionProviders joins them all.
 */
import { describe, expect, it } from 'vitest';

import { type CompletionProvider, handleProvider } from './completionProviders';
import { ACCOUNT, author, mention, sessionWith } from '../test/completionSessions';
import { notification, status } from '../test/fixtures';

describe(handleProvider, () => {
  it('accepts any word with the at sign, wherever it stands', () => {
    const provider: CompletionProvider = handleProvider(sessionWith());

    expect(provider.accepts('@al', true)).toBe(true);
    expect(provider.accepts('@', false)).toBe(true);
    expect(provider.accepts('al', false)).toBe(false);
    expect(provider.accepts(':lain:', true)).toBe(false);
  });

  it('offers the accounts the buffers showed: authors, boosters, quotes, mentions and notifications', () => {
    const state = sessionWith({
      statuses: [
        status('a1', {
          account: author('alice@m.example'),
          quote: status('q1', { account: author('carol@q.example') }),
        }),
        status('b1', {
          account: author('bob@boost.example'),
          reblog: status('r1', { account: author('rita@r.example') }),
        }),
        status('p1', {
          account: author('nick@n.example'),
          mentions: [mention('mel@mention.example')],
        }),
      ],
      notifications: [notification('n1', status('s1', { account: author('sam@s.example') }))],
    });

    expect(handleProvider(state).candidates('@')).toStrictEqual([
      '@alice@m.example',
      '@bob@boost.example',
      '@carol@q.example',
      '@lain@wired.example',
      '@mel@mention.example',
      '@nick@n.example',
      '@rita@r.example',
      '@sam@s.example',
    ]);
  });

  it('adds the signed-in accounts and narrows to the typed prefix without case', () => {
    const provider = handleProvider(sessionWith({ accounts: [ACCOUNT] }));

    expect(provider.candidates('@la')).toStrictEqual(['@lain@wired.example']);
    expect(provider.candidates('@LA')).toStrictEqual(['@lain@wired.example']);
    expect(provider.candidates('@zz')).toStrictEqual([]);
  });

  it('deduplicates spellings of one account, keeping the first one seen', () => {
    const state = sessionWith({
      statuses: [
        status('d1', {
          account: author('Alice@M.Example'),
          mentions: [mention('alice@m.example')],
        }),
      ],
    });

    expect(handleProvider(state).candidates('@AL')).toStrictEqual(['@Alice@M.Example']);
  });

  it('sorts the matches and offers at most fifty', () => {
    const sixty = Array.from({ length: 60 }, (_unused, index) =>
      status(`many-${String(index)}`, {
        account: author(`aa${String(index + 1).padStart(2, '0')}@many.example`),
      }),
    );
    const candidates = handleProvider(sessionWith({ statuses: sixty })).candidates('@aa');

    expect(candidates).toHaveLength(50);
    expect(candidates[0]).toBe('@aa01@many.example');
    expect(candidates[49]).toBe('@aa50@many.example');
  });
});
