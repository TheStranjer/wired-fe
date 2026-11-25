/**
 * Tests for viaFor (decision 14, WFE-226): the marker appears only on lines of
 * a feed window whose sources span several accounts; it names the acting
 * account by its local part unless another signed-in account shares it, adds
 * `+N` for the other accounts that saw the line and lists all of them in full.
 */
import { describe, expect, it } from 'vitest';

import { viaFor } from './via';
import { accountKey } from '../accounts/accountStore';
import { type AppState, coreReducer, printAction } from '../state/appState';
import { EMPTY_BUFFER } from '../state/buffer';
import { type FeedItem, notificationItem, postItem } from '../state/feedItem';
import type { FeedSpec } from '../state/feeds';
import { appReducer } from '../state/reducer';
import { A_HOME, B_HOME } from '../test/feedItems';
import { A_ACCOUNT, B_ACCOUNT, feedState, feedWindowId } from '../test/feedWindow';
import { notification, status } from '../test/fixtures';
import { type WindowRef, windowId } from '../windows/model';

const A_KEY = A_ACCOUNT.key;
const B_KEY = B_ACCOUNT.key;
const SOURCES = [
  { accountKey: A_KEY, source: 'home' },
  { accountKey: B_KEY, source: 'home' },
] as const;
const SPEC: FeedSpec = { id: 'f1', name: 'main', sources: SOURCES };
const WINDOW = feedWindowId('f1');

/** A post item as `source` fetched it, that more accounts then saw. */
function seen(id: string, seenBy: readonly string[]): FeedItem {
  return { ...postItem(status(id), { accountKey: A_KEY, source: 'home' }), seenBy };
}

/** The multi-account feed with `items` shown. */
function shown(items: readonly FeedItem[], feed: FeedSpec = SPEC): AppState {
  return appReducer(feedState([feed]), { type: 'feed', windowId: WINDOW, items });
}

describe(viaFor, () => {
  it('names the one account that saw a line by its local part', () => {
    const state = shown([postItem(status('p'), A_HOME)]);

    expect(viaFor(state, WINDOW, 'post:p')).toStrictEqual({
      label: 'lain',
      full: '@lain@a.example',
    });
  });

  it('adds +N for the other accounts that saw it and lists them all in full', () => {
    const state = shown([seen('p', [A_KEY, B_KEY])]);

    expect(viaFor(state, WINDOW, 'post:p')).toStrictEqual({
      label: 'lain +1',
      full: '@lain@a.example, @navi@b.example',
    });
  });

  it('marks a notification line the same way', () => {
    const item = notificationItem(notification('n', null), B_HOME);
    const state = shown([item]);

    expect(viaFor(state, WINDOW, `notif:${B_KEY}:n`)).toStrictEqual({
      label: 'navi',
      full: '@navi@b.example',
    });
  });

  it('keeps the whole handle when another signed-in account shares the local part', () => {
    const twin = {
      ...B_ACCOUNT,
      key: accountKey('https://c.example', '3'),
      handle: 'lain@c.example',
    };
    const signed = coreReducer(shown([seen('p', [A_KEY])]), {
      type: 'accounts',
      accounts: [A_ACCOUNT, B_ACCOUNT, twin],
      activeKey: A_KEY,
    });

    expect(viaFor(signed, WINDOW, 'post:p')).toStrictEqual({
      label: 'lain@a.example',
      full: '@lain@a.example',
    });
  });

  it('drops accounts that are no longer signed in', () => {
    const state = shown([seen('p', [A_KEY, 'https://gone.example#9'])]);

    expect(viaFor(state, WINDOW, 'post:p')?.label).toBe('lain');
  });

  it('marks nothing when no seeing account is signed in', () => {
    const state = shown([seen('p', ['https://gone.example#9'])]);

    expect(viaFor(state, WINDOW, 'post:p')).toBeNull();
  });

  it('acts as the fetching account for a line that records no one else', () => {
    const state = appReducer(feedState([SPEC]), {
      type: 'statuses',
      windowId: WINDOW,
      statuses: [status('p')],
      where: 'newer',
    });

    expect(viaFor(state, WINDOW, 'post:p')?.label).toBe('lain');
  });

  it('marks nothing on a line without an account', () => {
    const base = feedState([SPEC]);
    const line = { kind: 'post', key: 'post:p', status: status('p'), accountKey: null } as const;
    const state = {
      ...base,
      buffers: new Map(base.buffers).set(WINDOW, { ...EMPTY_BUFFER, lines: [line] }),
    };

    expect(viaFor(state, WINDOW, 'post:p')).toBeNull();
  });

  it('marks nothing on a key the buffer does not hold', () => {
    expect(viaFor(shown([seen('p', [A_KEY])]), WINDOW, 'post:other')).toBeNull();
  });

  it('marks nothing on a client message', () => {
    const base = shown([seen('p', [A_KEY])]);
    const state = appReducer(base, printAction(WINDOW, 'info', 'hi'));
    const message = state.buffers.get(WINDOW)?.lines.find((line) => line.kind === 'system');

    expect(viaFor(state, WINDOW, message?.key ?? '')).toBeNull();
  });

  it('marks nothing in a feed whose sources all use one account', () => {
    const single: FeedSpec = {
      id: 'f1',
      name: 'main',
      sources: [
        { accountKey: A_KEY, source: 'home' },
        { accountKey: A_KEY, source: 'local' },
      ],
    };

    expect(viaFor(shown([seen('p', [A_KEY, B_KEY])], single), WINDOW, 'post:p')).toBeNull();
  });

  it('marks nothing in a feed whose spec is gone', () => {
    const state = shown([seen('p', [A_KEY])], { ...SPEC, id: 'other' });

    expect(viaFor(state, WINDOW, 'post:p')).toBeNull();
  });

  it('marks nothing in a feed window that names no feed', () => {
    const state = appReducer(feedState([SPEC], null), {
      type: 'feed',
      windowId: feedWindowId(null),
      items: [seen('p', [A_KEY])],
    });

    expect(viaFor(state, feedWindowId(null), 'post:p')).toBeNull();
  });

  it('marks nothing in a window that is not a feed', () => {
    const ref: WindowRef = { kind: 'home', accountKey: A_KEY, target: null };
    const home = coreReducer(shown([seen('p', [A_KEY])]), {
      type: 'windows',
      action: { type: 'open', ref, title: 'home' },
    });

    expect(viaFor(home, windowId(ref), 'post:p')).toBeNull();
    expect(viaFor(home, 'no-such-window', 'post:p')).toBeNull();
  });
});
