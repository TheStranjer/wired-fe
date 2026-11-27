/**
 * Tests for the pane composers' drafts: the fields a window starts with, what
 * an edit or an append does to them, that only composer windows hold a draft
 * and a closed window's is forgotten, the draft the fields stand for, and the
 * limits each account's instance puts on a post.
 */
import { describe, expect, it } from 'vitest';

import { initialAppState } from './appState';
import type { AppState } from './appState';
import {
  composerFields,
  composerIsEmpty,
  composerLimits,
  composerReducer,
  withLiveComposers,
} from './composerActions';
import { COMMAND_LINE_MEDIA, uploadingMedia } from './composerMedia';
import { composerWindowOpen } from './composerWindow';
import type { ComposerFields } from './draft';
import { newPoll } from './pollEditor';
import { type AppAction, appReducer } from './reducer';
import type { StoredAccount } from '../accounts/accountStore';
import { type Capabilities, DEFAULT_POLL_LIMITS } from '../capabilities/capabilities';
import { capabilitiesOn } from '../capabilities/testCapabilities';
import { status } from '../test/fixtures';
import { STATUS_WINDOW_ID } from '../windows/model';

const ORIGIN = 'https://wired.example';

const ACCOUNT: StoredAccount = {
  key: `${ORIGIN}#1`,
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** A wired instance that serves local-only posts and caps posts at thirty. */
const CAPS: Capabilities = { ...capabilitiesOn('wired', ['localOnlyPosts']), maxCharacters: 30 };

/** A session signed in as lain, its instance detected as {@link CAPS} when asked. */
function session(detected: boolean): AppState {
  const actions: AppAction[] = [{ type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key }];
  if (detected) {
    actions.push({
      type: 'profile',
      profile: { origin: ORIGIN, title: 'wired.example', capabilities: CAPS },
    });
  }
  return actions.reduce(appReducer, initialAppState());
}

/** {@link state} with a composer open, and that composer's window id. */
function withComposer(state: AppState): readonly [AppState, string] {
  const opened = appReducer(state, {
    type: 'windows',
    action: composerWindowOpen(ACCOUNT, state.windows.windows),
  });
  return [opened, opened.windows.activeId];
}

describe(composerLimits, () => {
  it('reads the length and the local audience off the account’s instance', () => {
    expect(composerLimits(session(true), ACCOUNT.key)).toStrictEqual({
      maxCharacters: 30,
      allowLocal: true,
      pollLimits: DEFAULT_POLL_LIMITS,
    });
  });

  it('falls back to the unknown-instance limits while nothing is detected', () => {
    expect(composerLimits(session(false), ACCOUNT.key)).toStrictEqual({
      maxCharacters: 500,
      allowLocal: false,
      pollLimits: DEFAULT_POLL_LIMITS,
    });
  });

  it('uses the same fallback for no account at all', () => {
    expect(composerLimits(session(true), null)).toStrictEqual({
      maxCharacters: 500,
      allowLocal: false,
      pollLimits: DEFAULT_POLL_LIMITS,
    });
  });
});

describe(composerFields, () => {
  it('starts empty at the reader’s default audience', () => {
    const [state, id] = withComposer(session(false));

    expect(composerFields(state, id)).toStrictEqual({
      text: '',
      spoiler: '',
      visibility: state.settings.defaultVisibility,
    });
  });
});

describe(composerIsEmpty, () => {
  it('is true for a fresh composer, and false once anything is in it', () => {
    const [state, windowId] = withComposer(session(false));
    const edit = (patch: Partial<ComposerFields>): AppState =>
      appReducer(state, { type: 'composerEdit', windowId, patch });
    const poll = newPoll(DEFAULT_POLL_LIMITS);
    const media: AppAction = {
      type: 'composerMediaAdd',
      windowId,
      item: uploadingMedia('a', 'a.png'),
    };

    expect(composerIsEmpty(state, windowId)).toBe(true);
    expect(composerIsEmpty(edit({ text: 'x' }), windowId)).toBe(false);
    expect(composerIsEmpty(edit({ spoiler: 'cw' }), windowId)).toBe(false);
    expect(composerIsEmpty(edit({ poll }), windowId)).toBe(false);
    expect(composerIsEmpty(appReducer(state, media), windowId)).toBe(false);
  });

  it('is false for a reply composer, even before anything is typed', () => {
    const [state, windowId] = withComposer(session(false));
    const patch = { inReplyTo: { status: status('7'), accountKey: null } };

    const bound = appReducer(state, { type: 'composerEdit', windowId, patch });

    expect(composerIsEmpty(bound, windowId)).toBe(false);
  });

  it('is false for an edit composer, even before anything is typed', () => {
    const [state, windowId] = withComposer(session(false));
    const patch = { editing: { status: status('7'), accountKey: null } };

    const bound = appReducer(state, { type: 'composerEdit', windowId, patch });

    expect(composerIsEmpty(bound, windowId)).toBe(false);
  });

  it('is false for a quote composer, even before anything is typed', () => {
    const [state, windowId] = withComposer(session(false));
    const patch = { quoteOf: { status: status('7'), accountKey: null } };

    const bound = appReducer(state, { type: 'composerEdit', windowId, patch });

    expect(composerIsEmpty(bound, windowId)).toBe(false);
  });
});

describe(composerReducer, () => {
  it('edits only the fields the patch names', () => {
    const [state, windowId] = withComposer(session(false));

    const edited = appReducer(state, {
      type: 'composerEdit',
      windowId,
      patch: { text: 'wired', visibility: 'direct' },
    });

    expect(composerFields(edited, windowId)).toStrictEqual({
      text: 'wired',
      spoiler: '',
      visibility: 'direct',
    });
  });

  it('appends typed text on a new line under what is there', () => {
    const [state, windowId] = withComposer(session(false));
    const first = appReducer(state, { type: 'composerAppend', windowId, text: 'one' });

    const second = appReducer(first, { type: 'composerAppend', windowId, text: 'two' });

    expect(composerFields(first, windowId).text).toBe('one');
    expect(composerFields(second, windowId).text).toBe('one\ntwo');
  });

  it('leaves the state alone for a window that is not a composer', () => {
    const state = session(false);

    expect(
      composerReducer(state, { type: 'composerAppend', windowId: STATUS_WINDOW_ID, text: 'x' }),
    ).toBe(state);
    expect(
      composerReducer(state, { type: 'composerEdit', windowId: 'nope', patch: { text: 'x' } }),
    ).toBe(state);
  });
});

describe(withLiveComposers, () => {
  it('forgets the draft of a closed composer, so a reopened one starts empty', () => {
    const [state, windowId] = withComposer(session(false));
    const typed = appReducer(state, { type: 'composerAppend', windowId, text: 'draft' });

    const closed = appReducer(typed, {
      type: 'windows',
      action: { type: 'close', id: windowId },
    });
    const [reopened, again] = withComposer(closed);

    expect(closed.composers.size).toBe(0);
    expect(again).toBe(windowId);
    expect(composerFields(reopened, again).text).toBe('');
  });

  it('keeps the command line’s media when a composer closes', () => {
    const [state, windowId] = withComposer(session(false));
    const held = appReducer(state, {
      type: 'composerMediaAdd',
      windowId: COMMAND_LINE_MEDIA,
      item: uploadingMedia('k1', 'pixel.png'),
    });

    const closed = appReducer(held, { type: 'windows', action: { type: 'close', id: windowId } });

    expect(closed.composerMedia.get(COMMAND_LINE_MEDIA)).toHaveLength(1);
  });

  it('is the same state while every draft’s window is open', () => {
    const [state, windowId] = withComposer(session(false));
    const typed = appReducer(state, { type: 'composerAppend', windowId, text: 'draft' });

    expect(withLiveComposers(typed)).toBe(typed);
  });
});
