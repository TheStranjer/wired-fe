/**
 * Tests for /copy: the label and the navigation selection put the post's
 * `url ?? uri` on the clipboard and print it back; a boost copies its
 * original; and a browser that rejects the write, or has no clipboard API at
 * all, is answered with the plain refusal and no printed copy.
 */
import { type Mock, afterEach, describe, expect, it, vi } from 'vitest';

import { command } from './copy';
import type { StoredAccount } from '../../accounts/accountStore';
import type { Status } from '../../api/schemas/status';
import { type AppState, initialAppState } from '../../state/appState';
import { appReducer } from '../../state/reducer';
import { fakeCommandContext } from '../../test/commandContext';
import { status } from '../../test/fixtures';
import { type WindowRef, windowId } from '../../windows/model';
import type { CommandContext } from '../types';

const ORIGIN = 'https://wired.example';

/** The signed-in account whose home window shows the posts. */
const LAIN: StoredAccount = {
  key: `${ORIGIN}#1`,
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'token',
  refreshToken: null,
  expiresAt: null,
};

/** Lain's home window: the active window the target resolver reads. */
const HOME: WindowRef = { kind: 'home', accountKey: LAIN.key, target: null };

const HOME_ID = windowId(HOME);

/** A post with a web page of its own. */
const ALPHA = status('a', {
  uri: 'https://pleroma.example/n/a',
  url: 'https://pleroma.example/a',
});

/** A post whose schema-default url is null; only its uri links. */
const NO_URL = status('n', { uri: 'https://pleroma.example/n/n' });

/** A boost showing ALPHA; copying it must follow the original. */
const BOOST = status('b', { reblog: ALPHA });

/** The clipboard as the command sees it: only writeText matters here. */
type ClipboardStub = { readonly writeText: (text: string) => Promise<void> };

/** Put {@link clipboard} — or none at all — in place of the browser's API. */
function stubClipboard(clipboard: ClipboardStub | undefined): void {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
}

/** The signed-in state with lain's home window showing {@link posts}. */
function homeState(posts: readonly Status[], selectedId: string | null): AppState {
  const signedIn = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const opened = appReducer(signedIn, {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
  const filled = appReducer(opened, {
    type: 'statuses',
    windowId: HOME_ID,
    statuses: posts,
    where: 'newer',
  });
  if (selectedId === null) {
    return filled;
  }
  return appReducer(filled, { type: 'select', windowId: HOME_ID, key: `post:${selectedId}` });
}

/** A context whose active window shows {@link posts}, {@link selectedId} selected. */
function homeContext(
  posts: readonly Status[],
  selectedId: string | null = null,
): {
  readonly context: CommandContext;
  readonly print: Mock<CommandContext['print']>;
} {
  const state = homeState(posts, selectedId);
  const print = vi.fn<CommandContext['print']>();
  return { context: fakeCommandContext({ state, windows: state.windows, print }), print };
}

describe('/copy', () => {
  /** jsdom has no clipboard; every stubbed one is taken back after the test. */
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

  afterEach(() => {
    if (originalClipboard === undefined) {
      Reflect.deleteProperty(navigator, 'clipboard');
    } else {
      Object.defineProperty(navigator, 'clipboard', originalClipboard);
    }
  });

  it('copies the labelled post url and prints it', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    const { context, print } = homeContext([ALPHA]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(writeText).toHaveBeenCalledWith('https://pleroma.example/a');
    expect(print).toHaveBeenCalledWith('copied https://pleroma.example/a');
  });

  it('copies the WiredFE permalink of a post on the account instance', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    const { context, print } = homeContext([status('l', { url: `${ORIGIN}/notice/l` })]);
    const permalink = `${window.location.origin}${window.location.pathname}#/notice/l`;

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(writeText).toHaveBeenCalledWith(permalink);
    expect(print).toHaveBeenCalledWith(`copied ${permalink}`);
  });

  it('copies the uri when the post carries no url', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    const { context, print } = homeContext([NO_URL]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(writeText).toHaveBeenCalledWith('https://pleroma.example/n/n');
    expect(print).toHaveBeenCalledWith('copied https://pleroma.example/n/n');
  });

  it('copies the navigation selection when no label is given', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    const { context } = homeContext([NO_URL, ALPHA], 'a');

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(writeText).toHaveBeenCalledWith('https://pleroma.example/a');
  });

  it('copies the original of a boost', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    const { context } = homeContext([BOOST]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(writeText).toHaveBeenCalledWith('https://pleroma.example/a');
  });

  it('refuses when the browser rejects the write', async () => {
    const writeText = vi
      .fn<(text: string) => Promise<void>>()
      .mockRejectedValue(new DOMException('NotAllowedError'));
    stubClipboard({ writeText });
    const { context, print } = homeContext([ALPHA]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Clipboard unavailable' });
    expect(print).not.toHaveBeenCalled();
  });

  it('refuses when the browser has no clipboard API', async () => {
    stubClipboard(undefined);
    const { context, print } = homeContext([ALPHA]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Clipboard unavailable' });
    expect(print).not.toHaveBeenCalled();
  });

  it('refuses a label this window never gave', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    const { context } = homeContext([ALPHA]);

    const outcome = await command.run('z9', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'No post z9 here' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('refuses while nobody is signed in', async () => {
    const outcome = await command.run('a0', fakeCommandContext());

    expect(outcome).toStrictEqual({ ok: false, message: 'Not logged in. Type /connect' });
  });
});
