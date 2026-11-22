/**
 * Tests for the body the six account toggles share, over the MSW server:
 * every action sent to the account a label or a handle names, its
 * relationship answer printed as the line it leaves the viewer at, a follow
 * the target must still accept reported as requested, the other commands
 * shrugging off trailing words, the actor's own account refused with nothing
 * sent, a failed call reported as the API error, and the target resolver's
 * refusals coming back instead of a request. /mute and its duration parser
 * live in ./accountToggle.mute.test.ts.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { accountToggleRun } from './accountToggle';
import { fakeCommandContext } from '../test/commandContext';
import { status } from '../test/fixtures';
import { FOREIGN_WIRE, ORIGIN, homeContext, serveAccountActions } from '../test/homeWindow';
import { server } from '../test/server';

/** Somebody else's post: its author is the account every toggle acts on. */
const FOREIGN = status('q', { account: FOREIGN_WIRE });

/** A post of lain's own, the signed-in account, for the self-target refusal. */
const MINE = status('p');

/** The relationship an instance answers with: nobody followed, none requested. */
const RELATIONSHIP = { id: '2' };

/** The handle printing ends every line with. */
const SMILING = '@smiling@wired.example';

/** The six actions: the command, the path it posts to, the word it prints. */
const TOGGLES = [
  { command: 'follow', path: 'follow', word: 'following' },
  { command: 'unfollow', path: 'unfollow', word: 'unfollowed' },
  { command: 'block', path: 'block', word: 'blocked' },
  { command: 'unblock', path: 'unblock', word: 'unblocked' },
  { command: 'mute', path: 'mute', word: 'muted' },
  { command: 'unmute', path: 'unmute', word: 'unmuted' },
] as const;

describe(accountToggleRun, () => {
  it.each(TOGGLES)('/$command sends $path and prints $word', async (toggle) => {
    const calls = serveAccountActions(RELATIONSHIP);
    const context = homeContext([FOREIGN]);

    const outcome = await accountToggleRun(toggle.command, toggle.word)('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls).toStrictEqual([{ path: `/api/v1/accounts/2/${toggle.path}`, body: undefined }]);
    expect(context.print).toHaveBeenCalledWith(`${toggle.word} ${SMILING}`);
  });

  it('reports a follow the locked target still has to accept as requested', async () => {
    serveAccountActions({ ...RELATIONSHIP, requested: true });
    const context = homeContext([FOREIGN]);

    const outcome = await accountToggleRun('follow', 'following')('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.print).toHaveBeenCalledWith(`follow requested ${SMILING}`);
  });

  it('acts on the account a handle names, through the instance lookup', async () => {
    const calls = serveAccountActions(RELATIONSHIP);
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/lookup`, () => {
        return HttpResponse.json(FOREIGN_WIRE);
      }),
    );
    const context = homeContext([]);

    const outcome = await accountToggleRun('block', 'blocked')('@smiling@wired.example', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls).toStrictEqual([{ path: '/api/v1/accounts/2/block', body: undefined }]);
    expect(context.print).toHaveBeenCalledWith(`blocked ${SMILING}`);
  });

  it('ignores a trailing word on the commands that take no duration', async () => {
    const calls = serveAccountActions(RELATIONSHIP);
    const context = homeContext([FOREIGN]);

    const outcome = await accountToggleRun('follow', 'following')('a0 30m', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls).toStrictEqual([{ path: '/api/v1/accounts/2/follow', body: undefined }]);
    expect(context.print).toHaveBeenCalledWith(`following ${SMILING}`);
  });

  it.each(TOGGLES)('/$command refuses the actor herself, sending nothing', async (toggle) => {
    const calls = serveAccountActions(RELATIONSHIP);
    const context = homeContext([MINE]);

    const outcome = await accountToggleRun(toggle.command, toggle.word)('a0', context);

    expect(outcome).toStrictEqual({ ok: false, message: "That's you" });
    expect(calls).toStrictEqual([]);
    expect(context.print).not.toHaveBeenCalled();
  });

  it('reports the instance turning the action down', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/accounts/:id/block`, () => {
        return HttpResponse.json({ error: 'Record not found' }, { status: 404 });
      }),
    );
    const context = homeContext([FOREIGN]);

    const outcome = await accountToggleRun('block', 'blocked')('a0', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'HTTP 404: Record not found' });
    expect(context.print).not.toHaveBeenCalled();
  });

  it('refuses with nothing to resolve, sending nothing', async () => {
    const calls = serveAccountActions(RELATIONSHIP);
    const context = homeContext([FOREIGN]);

    const outcome = await accountToggleRun('block', 'blocked')('', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: 'Select a post first (j/k) or give a label',
    });
    expect(calls).toStrictEqual([]);
  });

  it('refuses while nobody is signed in, before asking the network', async () => {
    // No handler is registered: any request would fail the test.
    const context = fakeCommandContext();

    const outcome = await accountToggleRun('follow', 'following')(
      '@smiling@wired.example',
      context,
    );

    expect(outcome).toStrictEqual({ ok: false, message: 'Not logged in. Type /connect' });
    expect(context.print).not.toHaveBeenCalled();
  });
});
