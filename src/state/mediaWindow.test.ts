/**
 * Tests for opening a post's attachment in a media window (WFE-263): the
 * target encoding and its reading back, the titles with and without a label,
 * the open transition, and the sibling a window steps to.
 */
import { describe, expect, it } from 'vitest';

import {
  mediaOpen,
  mediaSibling,
  mediaStep,
  mediaTarget,
  mediaTitle,
  parseMediaTarget,
} from './mediaWindow';
import { type WindowState, windowId } from '../windows/model';

/** A media window of {@link target} titled {@link title}. */
function windowOf(target: string | null, title: string): WindowState {
  const ref = { kind: 'media' as const, accountKey: 'k', target };
  return { id: windowId(ref), ref, title, unread: 0, highlight: false, display: {} };
}

describe('media targets', () => {
  it('round-trips a status id and an index', () => {
    expect(parseMediaTarget(mediaTarget('109', 3))).toStrictEqual({ statusId: '109', n: 3 });
  });

  it('keeps colons inside the status id', () => {
    expect(parseMediaTarget(mediaTarget('a:b', 2))).toStrictEqual({ statusId: 'a:b', n: 2 });
  });

  it.each([null, '', '109', ':1', '109:', '109:0', '109:x', '109:-1', '109:1.5'])(
    'reads %j as no target',
    (target) => {
      expect(parseMediaTarget(target)).toBeNull();
    },
  );
});

describe(mediaTitle, () => {
  it('names the label when it is known', () => {
    expect(mediaTitle('c1', 1, 3)).toBe('media [c1] 1/3');
  });

  it('leaves the label out when it is not', () => {
    expect(mediaTitle(null, 2, 3)).toBe('media 2/3');
  });
});

describe(mediaOpen, () => {
  it('builds the open of the attachment, owned by the post account', () => {
    expect(
      mediaOpen({ statusId: '109', accountKey: 'k', n: 2, total: 3, label: 'c1' }),
    ).toStrictEqual({
      type: 'open',
      ref: { kind: 'media', accountKey: 'k', target: '109:2' },
      title: 'media [c1] 2/3',
    });
  });

  it('opens an unlabelled attachment and an account-less one', () => {
    expect(
      mediaOpen({ statusId: '109', accountKey: null, n: 1, total: 1, label: null }),
    ).toStrictEqual({
      type: 'open',
      ref: { kind: 'media', accountKey: null, target: '109:1' },
      title: 'media 1/1',
    });
  });
});

describe(mediaSibling, () => {
  it('opens another index of the same post, keeping account and label', () => {
    expect(
      mediaSibling(windowOf('109:1', 'media [c1] 1/3'), '109', { n: 2, total: 3 }),
    ).toStrictEqual({
      type: 'open',
      ref: { kind: 'media', accountKey: 'k', target: '109:2' },
      title: 'media [c1] 2/3',
    });
  });

  it('keeps a title with no label without one', () => {
    expect(mediaSibling(windowOf('109:2', 'media 2/3'), '109', { n: 1, total: 3 }).title).toBe(
      'media 1/3',
    );
  });
});

describe(mediaStep, () => {
  it('activates the window, opens the sibling and closes the window', () => {
    const win = windowOf('109:1', 'media [c1] 1/3');

    expect(mediaStep(win, '109', { n: 2, total: 3 })).toStrictEqual([
      { type: 'activate', id: win.id },
      mediaOpen({ statusId: '109', accountKey: 'k', n: 2, total: 3, label: 'c1' }),
      { type: 'close', id: win.id },
    ]);
  });
});
