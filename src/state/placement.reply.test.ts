/**
 * Tests for where a reply composer opens (WFE-244, decision 13): `--in`, else
 * the `composer` kind's setting, else `replyIn` — never the global default.
 */
import { describe, expect, it } from 'vitest';

import {
  type KindPlacements,
  type Placement,
  type ReplySettings,
  resolveReplyPlacement,
} from './placement';

describe('where a reply composer opens', () => {
  const by = { composer: 'float' } as const;
  const reply = (openInByKind: KindPlacements, replyIn: Placement): ReplySettings => ({
    openIn: 'here',
    openInByKind,
    replyIn,
  });

  it('takes the override over the composer setting and replyIn', () => {
    expect(resolveReplyPlacement(reply(by, 'split'), 'hidden')).toBe('hidden');
  });

  it('takes the composer kind’s setting over replyIn', () => {
    expect(resolveReplyPlacement(reply(by, 'split'), null)).toBe('float');
  });

  it('takes replyIn, not the default placement, when nothing else says', () => {
    expect(resolveReplyPlacement(reply({}, 'vsplit'), null)).toBe('vsplit');
  });
});
