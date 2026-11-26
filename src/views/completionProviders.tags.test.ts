/**
 * Tests for the tag provider: the hashtags the statuses in the buffers carry,
 * boosts, quotes and notification statuses included, matching the typed word
 * without case, deduplicated, sorted. See ./completionProviders.test.ts for
 * the handles and ./completionProviders.emoji.test.ts for the emoji.
 */
import { describe, expect, it } from 'vitest';

import { tagProvider } from './completionProviders';
import { ACCOUNT, author, sessionWith, tag } from '../test/completionSessions';
import { notification, status } from '../test/fixtures';

describe(tagProvider, () => {
  it('accepts any word with the hash, wherever it stands', () => {
    const provider = tagProvider(sessionWith());

    expect(provider.accepts('#la', false)).toBe(true);
    expect(provider.accepts('#', true)).toBe(true);
    expect(provider.accepts('la', false)).toBe(false);
    expect(provider.accepts('@lain', false)).toBe(false);
  });

  it('offers the tags of the statuses in the buffers, with boosts, quotes and notifications', () => {
    const state = sessionWith({
      statuses: [
        status('t1', {
          account: author('alice@m.example'),
          tags: [tag('Lain'), tag('news'), tag('lain')],
        }),
        status('t3', {
          account: author('bob@boost.example'),
          reblog: status('t4', { tags: [tag('old')] }),
          quote: status('t5', { tags: [tag('qt')] }),
        }),
      ],
      notifications: [
        notification('t6n', status('t6', { tags: [tag('notif')] })),
        notification('t7n', null),
      ],
    });

    expect(tagProvider(state).candidates('#')).toStrictEqual([
      '#Lain',
      '#news',
      '#notif',
      '#old',
      '#qt',
    ]);
    expect(tagProvider(state).candidates('#N')).toStrictEqual(['#news', '#notif']);
    expect(tagProvider(state).candidates('#zz')).toStrictEqual([]);
  });

  it('offers nothing for a session whose buffers showed no posts', () => {
    const state = sessionWith({ accounts: [ACCOUNT] });

    expect(tagProvider(state).candidates('#')).toStrictEqual([]);
  });
});
