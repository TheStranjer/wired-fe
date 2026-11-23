/**
 * Tests for /quote: the label and the navigation selection resolve to the
 * quoted post and the leftover text is posted through the window with its id
 * — a boost quotes its original under the boost line's label — while the
 * window prints `❝ quoted [a0]`; the post handler's error string comes back
 * as the command's failure. The refusals come before any posting: an instance
 * without `quotePosting`, detected or never, answers `This server does not
 * support quote posts`, no target refuses through the resolver, and empty
 * text echoes the usage.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './quote';
import type { StoredAccount } from '../../accounts/accountStore';
import type { Status } from '../../api/schemas/status';
import {
  type Capabilities,
  DEFAULT_POLL_LIMITS,
  type FeatureFlag,
} from '../../capabilities/capabilities';
import type { InstanceProfile } from '../../capabilities/detect';
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

/** The instance's feature set: only what each test names. */
function capsWith(...flags: readonly FeatureFlag[]): Capabilities {
  return {
    backend: 'wired',
    maxCharacters: 500,
    maxMediaAttachments: 4,
    pollLimits: DEFAULT_POLL_LIMITS,
    features: new Set<FeatureFlag>(flags),
  };
}

/** A plain post for the scrollback; its label is the one the command prints. */
const POST = status('p');

/** A boost of {@link POST}: quoting it quotes the original under `a0`. */
const BOOST = status('b', { reblog: POST });

/**
 * The signed-in state with lain's home window showing {@link posts} (API
 * order, newest first), the instance {@link capabilities} — or, when it is
 * null, never detected — and {@link selectedId} selected when one is given.
 */
function homeState(
  capabilities: Capabilities | null,
  posts: readonly Status[],
  selectedId: string | null,
): AppState {
  const signedIn = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const withProfile =
    capabilities === null
      ? signedIn
      : appReducer(signedIn, {
          type: 'profile',
          profile: { origin: ORIGIN, title: 'Wired', capabilities } satisfies InstanceProfile,
        });
  const opened = appReducer(withProfile, {
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
  capabilities: Capabilities | null,
  posts: readonly Status[],
  selectedId: string | null = null,
): CommandContext {
  const state = homeState(capabilities, posts, selectedId);
  return fakeCommandContext({ state, windows: state.windows });
}

/** The instance {@link POST} can be quoted on: it carries the flag. */
const QUOTING = capsWith('quotePosting');

describe('/quote', () => {
  it('posts the text quoting the labelled post and prints the line label', async () => {
    const context = homeContext(QUOTING, [POST]);

    const outcome = await command.run('a0 quoting this', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.post).toHaveBeenCalledWith({ text: 'quoting this', quoteId: 'p' });
    expect(context.print).toHaveBeenCalledWith('❝ quoted [a0]');
  });

  it('quotes the selected post and keeps the whole argument as text', async () => {
    const context = homeContext(QUOTING, [POST], 'p');

    const outcome = await command.run('look at this', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.post).toHaveBeenCalledWith({ text: 'look at this', quoteId: 'p' });
    expect(context.print).toHaveBeenCalledWith('❝ quoted [a0]');
  });

  it('quotes the original of a boost under the boost line label', async () => {
    const context = homeContext(QUOTING, [BOOST]);

    const outcome = await command.run('a0 original thought', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.post).toHaveBeenCalledWith({ text: 'original thought', quoteId: 'p' });
    expect(context.print).toHaveBeenCalledWith('❝ quoted [a0]');
  });

  it('reports the post handler refusing the draft', async () => {
    const state = homeState(QUOTING, [POST], null);
    const context = fakeCommandContext({
      state,
      windows: state.windows,
      post: vi.fn<CommandContext['post']>().mockResolvedValue('HTTP 422: cannot quote yourself'),
    });

    const outcome = await command.run('a0 hi', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'HTTP 422: cannot quote yourself' });
    expect(context.print).not.toHaveBeenCalled();
  });

  it('refuses on an instance without quotePosting, posting nothing', async () => {
    const context = homeContext(capsWith(), [POST]);

    const outcome = await command.run('a0 quoting this', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: 'This server does not support quote posts',
    });
    expect(context.post).not.toHaveBeenCalled();
    expect(context.print).not.toHaveBeenCalled();
  });

  it('refuses when capabilities were never detected', async () => {
    const context = homeContext(null, [POST]);

    const outcome = await command.run('a0 quoting this', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: 'This server does not support quote posts',
    });
  });

  it('echoes the usage when the label has no text behind it', async () => {
    const context = homeContext(QUOTING, [POST]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'Usage: /quote [label] <text>' });
    expect(context.post).not.toHaveBeenCalled();
  });

  it('refuses through the resolver when no post is named or selected', async () => {
    const context = homeContext(QUOTING, [POST]);

    const outcome = await command.run('quoting this', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: 'Select a post first (j/k) or give a label',
    });
    expect(context.post).not.toHaveBeenCalled();
  });
});
