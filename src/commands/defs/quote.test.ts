/**
 * Tests for /quote with text (WFE-262): the label and the navigation selection
 * resolve to the quoted post — a boost quotes its original under the boost
 * line's label — and the leftover text is created at once as the quoted
 * post's account with `quote_id` and the default audience, whatever kind the
 * active window is (a feed or notifications window takes no posts, a thread
 * would make it a reply, a dm a direct message); the home window shows the
 * answer and prints `❝ quoted [a0]`; a failed create comes back as
 * describeApiError says. The refusals come before any create: an instance
 * without `quotePosting`, detected or never, and no target. The composer a
 * text-less /quote opens is in ./quote.composer.test.ts.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { command } from './quote';
import { capabilitiesOn } from '../../capabilities/testCapabilities';
import { status } from '../../test/fixtures';
import {
  BOOST,
  HOME,
  ORIGIN,
  POST,
  createCarried,
  serveCreate,
  sessionContext,
} from '../../test/quoteSession';
import { server } from '../../test/server';
import { type WindowRef, windowId } from '../../windows/model';

/** The instance {@link POST} can be quoted on: it carries the flag. */
const QUOTING = capabilitiesOn('wired', ['quotePosting']);

/** The body a quote of {@link POST} sends: the text, the default audience and the quoted id. */
function quoteBody(text: string): Record<string, unknown> {
  return { status: text, visibility: 'public', quote_id: 'p' };
}

describe('/quote', () => {
  it('declares its grammar, summary and the q prefill and Shift+c composer bindings', () => {
    expect(command.usage).toBe('/quote [label] [text]');
    expect(command.summary).toBe(
      'Quote a post; with no text, open a composer (q prefills, Shift+c composes)',
    );
    expect(command.bindings).toStrictEqual([
      { mode: 'navigation', chord: 'q', args: '{label}', prefill: true },
      { mode: 'navigation', chord: 'Shift+c', args: '' },
    ]);
  });

  it('creates the quote as the post’s account, shows it and prints the line label', async () => {
    const created = status('quote');
    const calls = serveCreate(created);
    const context = sessionContext({ ref: HOME, posts: [POST], capabilities: QUOTING });

    const outcome = await command.run('a0 quoting this', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls).toStrictEqual([createCarried(quoteBody('quoting this'))]);
    expect(context.post).not.toHaveBeenCalled();
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'statuses',
      windowId: windowId(HOME),
      statuses: [created],
      where: 'newer',
    });
    expect(context.print).toHaveBeenCalledWith('❝ quoted [a0]');
  });

  it('quotes the selected post and keeps the whole argument as text', async () => {
    const calls = serveCreate(status('quote'));
    const context = sessionContext({
      ref: HOME,
      posts: [POST],
      capabilities: QUOTING,
      selectedId: 'p',
    });

    const outcome = await command.run('look at this', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls).toStrictEqual([createCarried(quoteBody('look at this'))]);
    expect(context.print).toHaveBeenCalledWith('❝ quoted [a0]');
  });

  it('quotes the original of a boost under the boost line label', async () => {
    const calls = serveCreate(status('quote'));
    const context = sessionContext({ ref: HOME, posts: [BOOST], capabilities: QUOTING });

    const outcome = await command.run('a0 original thought', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(calls).toStrictEqual([createCarried(quoteBody('original thought'))]);
    expect(context.print).toHaveBeenCalledWith('❝ quoted [a0]');
  });

  it('posts from a window that takes no posts, adding the quote to none', async () => {
    const refs: readonly WindowRef[] = [
      { kind: 'feed', accountKey: null, target: 'main' },
      { kind: 'notifications', accountKey: null, target: null },
    ];
    for (const ref of refs) {
      const calls = serveCreate(status('quote'));
      const context = sessionContext({ ref, posts: [POST], capabilities: QUOTING });

      const outcome = await command.run('a0 hello', context);

      expect(outcome).toStrictEqual({ ok: true });
      expect(calls).toStrictEqual([createCarried(quoteBody('hello'))]);
      expect(context.dispatch).not.toHaveBeenCalled();
      expect(context.print).toHaveBeenCalledWith('❝ quoted [a0]');
    }
  });

  it('quotes rather than replies from a thread window, and is no direct message in a dm', async () => {
    const refs: readonly WindowRef[] = [
      { kind: 'thread', accountKey: HOME.accountKey, target: '5' },
      { kind: 'dm', accountKey: HOME.accountKey, target: 'nine@pleroma.example' },
    ];
    for (const ref of refs) {
      const calls = serveCreate(status('quote'));
      const context = sessionContext({ ref, posts: [POST], capabilities: QUOTING });

      await command.run('a0 hello', context);

      expect(calls).toStrictEqual([createCarried(quoteBody('hello'))]);
    }
  });

  it('reports what describeApiError says of a failed create, printing nothing', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/statuses`, () =>
        HttpResponse.json({ error: 'Cannot quote a private post' }, { status: 422 }),
      ),
    );
    const context = sessionContext({ ref: HOME, posts: [POST], capabilities: QUOTING });

    const outcome = await command.run('a0 hi', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: 'HTTP 422: Cannot quote a private post',
    });
    expect(context.print).not.toHaveBeenCalled();
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('refuses on an instance without quotePosting, creating nothing', async () => {
    const context = sessionContext({
      ref: HOME,
      posts: [POST],
      capabilities: capabilitiesOn('wired', []),
    });

    const outcome = await command.run('a0 quoting this', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: "@lain@wired.example's server (Wired) can't quote posts",
    });
    expect(context.print).not.toHaveBeenCalled();
  });

  it('refuses when capabilities were never detected', async () => {
    const context = sessionContext({ ref: HOME, posts: [POST], capabilities: null });

    const outcome = await command.run('a0 quoting this', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: "@lain@wired.example's server can't quote posts",
    });
  });

  it('refuses through the resolver when no post is named or selected', async () => {
    const context = sessionContext({ ref: HOME, posts: [POST], capabilities: QUOTING });

    const outcome = await command.run('quoting this', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: 'Select a post first (j/k) or give a label',
    });
    expect(context.print).not.toHaveBeenCalled();
  });
});
