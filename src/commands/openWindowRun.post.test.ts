/**
 * Tests for the text after /home, /local and /federated (WFE-279): the window
 * is opened (placed by `--in` when it says so) and the text is then posted as
 * the active account with the reader's default audience, landing in that
 * window's scrollback as newer; no text posts nothing; a refused create is the
 * command's failure; pending media ride along and are cleared only when the
 * post is up. /notifications still ignores text.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { command as federated } from './defs/federated';
import { command as home } from './defs/home';
import { command as local } from './defs/local';
import { command as notifications } from './defs/notifications';
import type { CommandContext, CommandDefinition } from './types';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import type { MediaAttachment } from '../api/schemas/mediaAttachment';
import type { Status } from '../api/schemas/status';
import { coreReducer, initialAppState } from '../state/appState';
import { fakeAttachments, fakeCommandContext } from '../test/commandContext';
import { status } from '../test/fixtures';
import { server } from '../test/server';
import { windowId } from '../windows/model';

const ORIGIN = 'https://wired.example';
const CREATE = `${ORIGIN}/api/v1/statuses`;

/** The one account these sessions have. */
const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** The status the instance answers a create with. */
const CREATED = status('42');

/** An uploaded attachment waiting for the next post. */
const PENDING: MediaAttachment = {
  id: '12',
  type: 'image',
  url: 'https://wired.example/media/12.png',
  preview_url: null,
  remote_url: null,
  description: null,
  blurhash: null,
};

/** A signed-in context whose window and reducer asks are recorded. */
function signedIn(extra: Partial<CommandContext> = {}): CommandContext {
  const state = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT.key,
  });
  return fakeCommandContext({ state, ...extra });
}

/** Answers every create with {@link answered}, returning the bodies it was sent. */
function serveCreate(answered: Status): unknown[] {
  const bodies: unknown[] = [];
  server.use(
    http.post(CREATE, async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json(answered);
    }),
  );
  return bodies;
}

describe.each([
  ['/home', home, windowId({ kind: 'home', accountKey: ACCOUNT.key, target: null })],
  ['/local', local, windowId({ kind: 'local', accountKey: ACCOUNT.key, target: null })],
  ['/federated', federated, windowId({ kind: 'federated', accountKey: ACCOUNT.key, target: null })],
])('%s <text>', (_name, command: CommandDefinition, expectedId) => {
  it('opens the window, then posts the text into it as newer', async () => {
    const bodies = serveCreate(CREATED);
    const context = signedIn();

    const outcome = await command.run('sup', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatchWindows).toHaveBeenCalledTimes(1);
    expect(bodies).toStrictEqual([{ status: 'sup', visibility: 'public' }]);
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'statuses',
      windowId: expectedId,
      statuses: [CREATED],
      where: 'newer',
    });
  });

  it('keeps --in placing the window and posts the text before it', async () => {
    const bodies = serveCreate(CREATED);
    const context = signedIn();

    const outcome = await command.run('sup --in vsplit', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'openPlaced' }));
    expect(bodies).toStrictEqual([{ status: 'sup', visibility: 'public' }]);
  });

  it('posts nothing without text', async () => {
    const bodies = serveCreate(CREATED);
    const context = signedIn();

    await expect(command.run('', context)).resolves.toStrictEqual({ ok: true });
    await expect(command.run('--in float', context)).resolves.toStrictEqual({ ok: true });

    expect(bodies).toStrictEqual([]);
    expect(context.dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'statuses' }),
    );
  });

  it('fails with the instance’s error and moves no scrollback', async () => {
    server.use(
      http.post(CREATE, () => HttpResponse.json({ error: 'Text is too long' }, { status: 422 })),
    );
    const context = signedIn();

    const outcome = await command.run('sup', context);

    expect(outcome).toStrictEqual({ ok: false, message: 'HTTP 422: Text is too long' });
    expect(context.dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'statuses' }),
    );
  });

  it('carries the pending media and clears them once the post is up', async () => {
    const bodies = serveCreate(CREATED);
    const clear = vi.fn();
    const context = signedIn({ attachments: fakeAttachments({ pending: [PENDING], clear }) });

    await command.run('sup', context);

    expect(bodies).toStrictEqual([{ status: 'sup', visibility: 'public', media_ids: ['12'] }]);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('keeps the pending media when the post is refused', async () => {
    server.use(http.post(CREATE, () => HttpResponse.json({ error: 'no' }, { status: 422 })));
    const clear = vi.fn();
    const context = signedIn({ attachments: fakeAttachments({ pending: [PENDING], clear }) });

    await command.run('sup', context);

    expect(clear).not.toHaveBeenCalled();
  });
});

describe('/notifications <text>', () => {
  it('still ignores the text and posts nothing', async () => {
    const bodies = serveCreate(CREATED);
    const context = signedIn();

    const outcome = await notifications.run('sup', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatchWindows).toHaveBeenCalledTimes(1);
    expect(bodies).toStrictEqual([]);
  });
});
