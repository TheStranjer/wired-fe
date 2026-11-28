/**
 * Tests for /follow: the definition the command line, /help and completion
 * read, and a handle followed through the instance lookup — printed
 * `following @x`. The shared body, the requested answer and every refusal
 * live in ../accountToggle.test.ts.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { command } from './follow';
import { status } from '../../test/fixtures';
import { FOREIGN_WIRE, ORIGIN, homeContext, serveAccountActions } from '../../test/homeWindow';
import { server } from '../../test/server';

/** Lain's own post: /follow must refuse its author, the signed-in account. */
const MINE = status('p');

describe('/follow', () => {
  it('declares its name, grammar, summary and hotkey', () => {
    expect(command.name).toBe('follow');
    expect(command.usage).toBe('/follow [target]');
    expect(command.summary).toBe('Follow an account');
    expect(command.bindings).toStrictEqual([{ mode: 'navigation', chord: 'Shift+f', args: '' }]);
  });

  it('follows the account a handle names', async () => {
    const calls = serveAccountActions({ id: '2' });
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/lookup`, () => {
        return HttpResponse.json(FOREIGN_WIRE);
      }),
    );
    const context = homeContext([]);

    const outcome = await command.run('@smiling@wired.example', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls).toStrictEqual([{ path: '/api/v1/accounts/2/follow', body: undefined }]);
    expect(context.print).toHaveBeenCalledWith('following @smiling@wired.example');
  });

  it('follows the account a search finds when the lookup is a 404', async () => {
    const calls = serveAccountActions({ id: '2' });
    server.use(
      http.get(`${ORIGIN}/api/v1/accounts/lookup`, () => {
        return HttpResponse.json({ error: 'Record not found' }, { status: 404 });
      }),
      http.get(`${ORIGIN}/api/v2/search`, () => {
        const found = { ...FOREIGN_WIRE, acct: 'bob@remote.example' };
        return HttpResponse.json({ accounts: [found] });
      }),
    );
    const context = homeContext([]);

    const outcome = await command.run('@bob@remote.example', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls).toStrictEqual([{ path: '/api/v1/accounts/2/follow', body: undefined }]);
    expect(context.print).toHaveBeenCalledWith('following @bob@remote.example');
  });

  it('refuses to follow itself', async () => {
    const calls = serveAccountActions({ id: '1' });
    const context = homeContext([MINE]);

    const outcome = await command.run('a0', context);

    expect(outcome).toStrictEqual({ ok: false, message: "That's you" });
    expect(calls).toStrictEqual([]);
    expect(context.print).not.toHaveBeenCalled();
  });
});
