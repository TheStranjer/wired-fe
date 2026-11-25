/**
 * Tests for the placement knobs of /set (decision 13): `openIn` is an enum
 * knob like the others; `openIn.<kind>` shows, sets and takes back where
 * windows of one kind open, keeping the kinds it does not name; the listing
 * ends with the kinds that have a choice of their own; and an unknown kind, a
 * placement it does not list or a third word is refused with nothing changed.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { command } from './set';
import { initialAppState } from '../../state/appState';
import { DEFAULT_SETTINGS, type Settings } from '../../state/settings';
import { fakeCommandContext } from '../../test/commandContext';
import type { CommandContext } from '../types';

/** The words every placement knob takes. */
const WORDS = 'here|vsplit|split|float|hidden';

/** A context over a session whose settings are {@link settings}, print recorded. */
function contextWith(settings: Settings = DEFAULT_SETTINGS): {
  readonly context: CommandContext;
  readonly print: Mock<CommandContext['print']>;
} {
  const print: Mock<CommandContext['print']> = vi.fn();
  return { context: fakeCommandContext({ state: initialAppState(settings), print }), print };
}

describe('/set replyIn', () => {
  it('turns where a reply composer opens and prints it back', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('replyIn float', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'settings',
      settings: { replyIn: 'float' },
    });
    expect(print).toHaveBeenCalledWith('replyIn = float');
  });

  it('refuses a placement it does not list, naming the words', async () => {
    const { context } = contextWith();

    const outcome = await command.run('replyIn sideways', context);

    expect(outcome).toStrictEqual({ ok: false, message: `replyIn takes ${WORDS}` });
    expect(context.dispatch).not.toHaveBeenCalled();
  });
});

describe('/set openIn', () => {
  it('turns the default placement and prints it back', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('openIn float', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'settings',
      settings: { openIn: 'float' },
    });
    expect(print).toHaveBeenCalledWith('openIn = float');
  });

  it('refuses a placement it does not list, naming the words', async () => {
    const { context } = contextWith();

    const outcome = await command.run('openIn sideways', context);

    expect(outcome).toStrictEqual({ ok: false, message: `openIn takes ${WORDS}` });
    expect(context.dispatch).not.toHaveBeenCalled();
  });
});

describe('/set openIn.<kind>', () => {
  it('sets one kind’s placement and prints it back', async () => {
    const { context, print } = contextWith();

    const outcome = await command.run('openIn.thread vsplit', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'settings',
      settings: { openInByKind: { thread: 'vsplit' } },
    });
    expect(print).toHaveBeenCalledWith('openIn.thread = vsplit');
  });

  it('takes the word in any case and keeps the other kinds', async () => {
    const { context } = contextWith({ ...DEFAULT_SETTINGS, openInByKind: { dm: 'hidden' } });

    await command.run('openIn.thread SPLIT', context);

    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'settings',
      settings: { openInByKind: { dm: 'hidden', thread: 'split' } },
    });
  });

  it('takes a kind’s choice back with default', async () => {
    const { context, print } = contextWith({
      ...DEFAULT_SETTINGS,
      openInByKind: { dm: 'hidden', thread: 'float' },
    });

    await command.run('openIn.thread default', context);

    expect(context.dispatch).toHaveBeenCalledWith({
      type: 'settings',
      settings: { openInByKind: { dm: 'hidden' } },
    });
    expect(print).toHaveBeenCalledWith('openIn.thread = default');
  });

  it('shows a kind’s placement, or that it follows the default', async () => {
    const { context, print } = contextWith({
      ...DEFAULT_SETTINGS,
      openInByKind: { thread: 'float' },
    });

    await command.run('openIn.thread', context);
    await command.run('openIn.dm', context);

    expect(print.mock.calls).toStrictEqual([
      ['  openIn.thread = float'],
      ['  openIn.dm = default'],
    ]);
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it('refuses a placement it does not list, naming the words and default', async () => {
    const { context } = contextWith();

    const outcome = await command.run('openIn.thread sideways', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: `openIn.thread takes ${WORDS}|default`,
    });
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it.each([['toaster'], ['status'], ['']])(
    'refuses the kind %j, listing the kinds',
    async (kind) => {
      const { context } = contextWith();

      const outcome = await command.run(`openIn.${kind} float`, context);

      expect(outcome).toStrictEqual({
        ok: false,
        message: `No window kind ${kind}. Kinds: home, local, federated, notifications, thread, hashtag, profile, dm, search, composer, feed, people, media`,
      });
      expect(context.dispatch).not.toHaveBeenCalled();
    },
  );

  it('refuses a third word with the usage', async () => {
    const { context } = contextWith();

    const outcome = await command.run('openIn.thread float now', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message: `Usage: /set openIn.thread [${WORDS}|default]`,
    });
    expect(context.dispatch).not.toHaveBeenCalled();
  });
});

describe('/set with no argument', () => {
  it('ends the listing with the kinds that have a placement of their own', async () => {
    const { context, print } = contextWith({
      ...DEFAULT_SETTINGS,
      openInByKind: { thread: 'float', dm: 'hidden' },
    });

    await command.run('', context);

    expect(print.mock.calls.slice(-2)).toStrictEqual([
      ['  openIn.thread = float'],
      ['  openIn.dm = hidden'],
    ]);
  });
});
