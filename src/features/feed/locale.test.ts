/**
 * Tests that the feed slice's text follows the language in use (decision
 * 19): the topic line of a feed that has a posting account is read from the
 * catalog.
 */
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import { A_ACCOUNT, feedState, feedWindowId } from '../../test/feedWindow';
import { installFakeLocale } from '../../test/i18n';
import type { WindowState } from '../../windows/model';

describe('the feed slice in another language', () => {
  it('words its topic line from the catalog', () => {
    installFakeLocale({ features: { feed: { topic_posting: 'XX {title} as {handle}' } } });
    const win: WindowState = {
      id: feedWindowId('f1'),
      ref: { kind: 'feed', accountKey: null, target: 'f1' },
      title: '~main',
      unread: 0,
      highlight: false,
      display: {},
    };
    const feeds = [
      {
        id: 'f1',
        name: 'main',
        sources: [{ accountKey: A_ACCOUNT.key, source: 'home' }],
        postAs: A_ACCOUNT.key,
      },
    ] as const;

    expect(windowKind.topic(win, feedState(feeds))).toBe(`XX ~main as ${A_ACCOUNT.handle}`);
  });
});
