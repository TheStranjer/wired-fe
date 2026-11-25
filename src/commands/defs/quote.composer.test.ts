/**
 * Tests for the quote composer `/quote` opens when there is no text (WFE-262):
 * the composer window is bound to the labelled (or selected) post and posts as
 * the account of its line, its fields holding only the quoted post; it opens
 * where `--in`, `openIn.composer` or `replyIn` (default `split`) say; a `--in`
 * that names no placement is refused; the capability gate still comes first;
 * and nothing is created until the composer sends.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './quote';
import { capabilitiesOn } from '../../capabilities/testCapabilities';
import { composerFields } from '../../state/composerActions';
import { type AppAction, appReducer } from '../../state/reducer';
import { DEFAULT_SETTINGS } from '../../state/settings';
import { HOME, LAIN, POST, sessionContext } from '../../test/quoteSession';
import { windowId } from '../../windows/model';
import type { CommandContext } from '../types';

/** The instance {@link POST} can be quoted on: it carries the flag. */
const QUOTING = capabilitiesOn('wired', ['quotePosting']);

/** The composer window's id: the first draft, posting as lain's line. */
const COMPOSER_ID = windowId({ kind: 'composer', accountKey: LAIN.key, target: '1' });

/** The actions the command dispatched, as they were given. */
function dispatched(context: CommandContext): AppAction[] {
  return vi.mocked(context.dispatch).mock.calls.map(([action]) => action);
}

/** Lain's home window showing {@link POST}, with the settings of the caller. */
function home(settings = DEFAULT_SETTINGS, selectedId?: string): CommandContext {
  return sessionContext({
    ref: HOME,
    posts: [POST],
    capabilities: QUOTING,
    settings,
    ...(selectedId === undefined ? {} : { selectedId }),
  });
}

describe('/quote with no text', () => {
  it('opens a composer bound to the labelled post, split beside the focused pane', async () => {
    const context = home();

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

  it('binds the post and its line’s account, leaving the text empty', async () => {
    const context = home();

    await command.run('a0', context);
    const applied = dispatched(context).reduce(appReducer, context.state);

    expect(composerFields(applied, COMPOSER_ID)).toStrictEqual({
      text: '',
      spoiler: '',
      visibility: 'public',
      quoteOf: { status: POST, accountKey: LAIN.key },
    });
  });

  it('quotes the selected post when no label is given', async () => {
    const context = home(DEFAULT_SETTINGS, 'p');

    await command.run('', context);
    const applied = dispatched(context).reduce(appReducer, context.state);

    expect(composerFields(applied, COMPOSER_ID).quoteOf?.status.id).toBe('p');
  });

  it('opens where --in says, over the settings, float included', async () => {
    const byFlag = home({ ...DEFAULT_SETTINGS, replyIn: 'vsplit' });
    const floating = home();

    await command.run('a0 --in float', byFlag);
    await command.run('a0 --in float', floating);

    expect(dispatched(byFlag)[0]).toMatchObject({ type: 'openPlaced', placement: 'float' });
    expect(dispatched(floating)[0]).toMatchObject({ type: 'openPlaced', placement: 'float' });
  });

  it('opens where --in alone says when no label is given', async () => {
    const context = home(DEFAULT_SETTINGS, 'p');

    await command.run('--in hidden', context);

    expect(dispatched(context)[0]).toMatchObject({ type: 'openPlaced', placement: 'hidden' });
  });

  it('opens where replyIn says, and over it where openIn.composer says', async () => {
    const byReplyIn = home({ ...DEFAULT_SETTINGS, replyIn: 'float' });
    const byKind = home({
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
    const context = home();

    await command.run('a0 --in here', context);

    expect(context.dispatchWindows).toHaveBeenCalledWith(expect.objectContaining({ type: 'open' }));
    expect(dispatched(context)[0]).toMatchObject({ type: 'composerEdit' });
  });

  it('refuses a --in that names no placement, opening nothing', async () => {
    const context = home();

    await expect(command.run('a0 --in sideways', context)).resolves.toStrictEqual({
      ok: false,
      message: '--in takes here|vsplit|split|float|hidden',
    });
    expect(context.dispatch).not.toHaveBeenCalled();
    expect(context.dispatchWindows).not.toHaveBeenCalled();
  });

  it('refuses without quotePosting before opening anything', async () => {
    const context = sessionContext({
      ref: HOME,
      posts: [POST],
      capabilities: capabilitiesOn('wired', []),
    });

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: "@lain@wired.example's server (Wired) can't quote posts",
    });
    expect(context.dispatch).not.toHaveBeenCalled();
  });
});
