/**
 * Tests for /open: a typed URL opens with no target and no login; a label or
 * the navigation selection opens that post's url, falling back to its uri; a
 * boost opens its original; and http(s) is the only scheme handed to the
 * browser — a typed `javascript:` argument and a non-http post uri are both
 * refused without opening anything.
 */
import { type Mock, afterEach, describe, expect, it, vi } from 'vitest';

import { command } from './open';
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

/** A post whose only link is not http(s). */
const FTP_ONLY = status('f', { uri: 'ftp://example.org/x' });

/** A boost showing ALPHA; opening it must follow the original. */
const BOOST = status('b', { reblog: ALPHA });

/** Replace the browser's new-tab opener with a recording stub. */
function stubOpen(): Mock<Window['open']> {
  const opened = vi.fn<Window['open']>();
  vi.stubGlobal('open', opened);
  return opened;
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
function homeContext(posts: readonly Status[], selectedId: string | null = null): CommandContext {
  const state = homeState(posts, selectedId);
  return fakeCommandContext({ state, windows: state.windows });
}

describe('/open', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens a typed https URL with no target and no login', async () => {
    const opened = stubOpen();

    const outcome = await command.run('https://example.org/page?a=1', fakeCommandContext());

    expect(outcome).toStrictEqual({ ok: true });
    expect(opened).toHaveBeenCalledWith(
      'https://example.org/page?a=1',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('opens the url of the labelled post', async () => {
    const opened = stubOpen();

    const outcome = await command.run('a0', homeContext([ALPHA]));

    expect(outcome).toStrictEqual({ ok: true });
    expect(opened).toHaveBeenCalledWith(
      'https://pleroma.example/a',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('opens the thread window of a post on the account instance', async () => {
    const opened = stubOpen();
    const context = homeContext([status('l', { url: `${ORIGIN}/notice/l` })]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatchWindows).toHaveBeenCalledWith({
      type: 'open',
      ref: { kind: 'thread', accountKey: LAIN.key, target: 'l' },
      title: 'thread/a0',
    });
    expect(opened).not.toHaveBeenCalled();
  });

  it('opens the uri when the post carries no url', async () => {
    const opened = stubOpen();

    const outcome = await command.run('a0', homeContext([NO_URL]));

    expect(outcome).toStrictEqual({ ok: true });
    expect(opened).toHaveBeenCalledWith(
      'https://pleroma.example/n/n',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('follows the navigation selection when no label is given', async () => {
    const opened = stubOpen();

    const outcome = await command.run('', homeContext([NO_URL, ALPHA], 'a'));

    expect(outcome).toStrictEqual({ ok: true });
    expect(opened).toHaveBeenCalledWith(
      'https://pleroma.example/a',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('opens the original of a boost', async () => {
    const opened = stubOpen();

    const outcome = await command.run('a0', homeContext([BOOST]));

    expect(outcome).toStrictEqual({ ok: true });
    expect(opened).toHaveBeenCalledWith(
      'https://pleroma.example/a',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('refuses a javascript: argument and opens nothing', async () => {
    const opened = stubOpen();

    const outcome = await command.run('javascript:alert(1)', homeContext([ALPHA]));

    expect(outcome).toStrictEqual({ ok: false, message: 'Only http(s) links can be opened' });
    expect(opened).not.toHaveBeenCalled();
  });

  it('refuses a post whose link is not http(s)', async () => {
    const opened = stubOpen();

    const outcome = await command.run('a0', homeContext([FTP_ONLY]));

    expect(outcome).toStrictEqual({ ok: false, message: 'Only http(s) links can be opened' });
    expect(opened).not.toHaveBeenCalled();
  });

  it('refuses a label this window never gave', async () => {
    const opened = stubOpen();

    const outcome = await command.run('z9', homeContext([ALPHA]));

    expect(outcome).toStrictEqual({ ok: false, message: 'No post z9 here' });
    expect(opened).not.toHaveBeenCalled();
  });

  it('refuses when nothing is selected to fall back to', async () => {
    const outcome = await command.run('', homeContext([ALPHA]));

    expect(outcome).toStrictEqual({
      ok: false,
      message: 'Select a post first (j/k) or give a label',
    });
  });

  it('refuses while nobody is signed in', async () => {
    const outcome = await command.run('a0', fakeCommandContext());

    expect(outcome).toStrictEqual({ ok: false, message: 'Not logged in. Type /connect' });
  });
});
