/**
 * Tests for the reply composer `/reply` opens when there is no text (WFE-244):
 * the composer window is bound to the labelled (or selected) post and posts as
 * the account of its line, its fields holding the mentions, the post's audience
 * capped by the default and the post's content warning; it opens where `--in`,
 * `openIn.composer` or `replyIn` (default `split`) say; a `--in` that names no
 * placement is refused; and text still posts at once, with nothing opened.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './reply';
import type { StoredAccount } from '../../accounts/accountStore';
import type { Status } from '../../api/schemas/status';
import { composerFields } from '../../state/composerActions';
import { type AppAction, appReducer } from '../../state/reducer';
import { DEFAULT_SETTINGS, type Settings } from '../../state/settings';
import { fakeCommandContext } from '../../test/commandContext';
import { TEST_DATE, status } from '../../test/fixtures';
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

/** Nine: the author the tests answer, on somebody else's instance. */
const NINE_WIRE = {
  id: '9',
  username: 'nine',
  acct: 'nine@pleroma.example',
  display_name: 'Nine',
  created_at: TEST_DATE,
  note: '',
  url: 'https://pleroma.example/@nine',
  avatar: 'https://pleroma.example/avi.png',
  header: 'https://pleroma.example/banner.png',
  followers_count: 0,
  following_count: 0,
  statuses_count: 0,
};

/** The mention wires alice and lain (the replier) arrive as. */
const ALICE = {
  id: 'al',
  username: 'alice',
  acct: 'alice@wired.example',
  url: 'https://wired.example/@alice',
};
const LAIN_MENTION = { ...ALICE, id: '1', username: 'lain', acct: 'lain@wired.example' };

/** Nine's unlisted, content-warned post naming alice and lain: the line labelled `a0`. */
const POST = status('7', {
  account: NINE_WIRE,
  mentions: [ALICE, LAIN_MENTION],
  visibility: 'unlisted',
  spoiler_text: 'lain spoilers',
});

/** Lain's signed-in state whose active window is {@link HOME} showing {@link posts}, under {@link settings}. */
function feedState(
  posts: readonly Status[],
  settings: Settings = DEFAULT_SETTINGS,
): CommandContext {
  const signedIn = fakeCommandContext();
  const configured = appReducer(signedIn.state, { type: 'settings', settings });
  const withAccount = appReducer(configured, {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const opened = appReducer(withAccount, {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
  const filled = appReducer(opened, {
    type: 'statuses',
    windowId: windowId(HOME),
    statuses: posts,
    where: 'newer',
  });
  return { ...signedIn, state: filled, windows: filled.windows };
}

/** The composer window's id: the first draft, posting as lain's line. */
const COMPOSER_ID = windowId({ kind: 'composer', accountKey: LAIN.key, target: '1' });

/** {@link context} with the post `post:7` of the home window selected. */
function selecting(context: CommandContext): CommandContext {
  const state = appReducer(context.state, {
    type: 'select',
    windowId: windowId(HOME),
    key: 'post:7',
  });
  return { ...context, state };
}

/** The actions the command dispatched, as they were given. */
function dispatched(context: CommandContext): AppAction[] {
  return vi.mocked(context.dispatch).mock.calls.map(([action]) => action);
}

describe('/reply with no text', () => {
  it('opens a composer bound to the labelled post, split beside the focused pane', async () => {
    const context = feedState([POST]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatched(context)[0]).toStrictEqual({
      type: 'openPlaced',
      action: {
        type: 'open',
        ref: { kind: 'composer', accountKey: LAIN.key, target: '1' },
        title: 'compose',
      },
      placement: 'split',
    });
    expect(context.print).not.toHaveBeenCalled();
  });

  it('fills the fields: mentions without the replier, the post’s audience, its warning, its id', async () => {
    const context = feedState([POST]);

    await command.run('a0', context);
    const applied = dispatched(context).reduce(appReducer, context.state);

    expect(composerFields(applied, COMPOSER_ID)).toStrictEqual({
      text: '@nine@pleroma.example @alice@wired.example ',
      spoiler: 'lain spoilers',
      visibility: 'unlisted',
      inReplyTo: { status: POST, accountKey: LAIN.key },
    });
  });

  it('caps the post’s audience by the default', async () => {
    const context = feedState([status('7', { account: NINE_WIRE })], {
      ...DEFAULT_SETTINGS,
      defaultVisibility: 'private',
    });

    await command.run('a0', context);
    const applied = dispatched(context).reduce(appReducer, context.state);

    expect(composerFields(applied, COMPOSER_ID).visibility).toBe('private');
  });

  it('answers the selected post when no label is given', async () => {
    const context = selecting(feedState([POST]));

    await command.run('', context);
    const applied = dispatched(context).reduce(appReducer, context.state);

    expect(composerFields(applied, COMPOSER_ID).inReplyTo?.status.id).toBe('7');
  });

  it('opens where --in says, over the settings', async () => {
    const context = feedState([POST], { ...DEFAULT_SETTINGS, replyIn: 'float' });

    await command.run('a0 --in vsplit', context);

    expect(dispatched(context)[0]).toMatchObject({ type: 'openPlaced', placement: 'vsplit' });
  });

  it('opens where --in alone says when no label is given', async () => {
    const context = selecting(feedState([POST]));

    await command.run('--in hidden', context);

    expect(dispatched(context)[0]).toMatchObject({ type: 'openPlaced', placement: 'hidden' });
  });

  it('opens where replyIn says, and over it where openIn.composer says', async () => {
    const byReplyIn = feedState([POST], { ...DEFAULT_SETTINGS, replyIn: 'float' });
    const byKind = feedState([POST], {
      ...DEFAULT_SETTINGS,
      replyIn: 'float',
      openInByKind: { composer: 'vsplit' },
    });

    await command.run('a0', byReplyIn);
    await command.run('a0', byKind);

    expect(dispatched(byReplyIn)[0]).toMatchObject({ placement: 'float' });
    expect(dispatched(byKind)[0]).toMatchObject({ placement: 'vsplit' });
  });

  it('opens in the focused pane for here, as a plain window open', async () => {
    const context = feedState([POST]);

    await command.run('a0 --in here', context);

    expect(context.dispatchWindows).toHaveBeenCalledWith(expect.objectContaining({ type: 'open' }));
    expect(dispatched(context)[0]).toMatchObject({ type: 'composerEdit' });
  });

  it('refuses a --in that names no placement, opening nothing', async () => {
    const context = feedState([POST]);

    await expect(command.run('a0 --in sideways', context)).resolves.toStrictEqual({
      ok: false,
      message: '--in takes here|vsplit|split|float|hidden',
    });
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(context.dispatchWindows).not.toHaveBeenCalled();
  });
});
