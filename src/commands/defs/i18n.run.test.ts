/**
 * What /about through /follow print and refuse with, in the language in use
 * (WFE-313, decision 19): the fake language marks every message of
 * `commands.defs` with `§ `, so a line without the mark is still a literal at
 * its call site. Summaries and usage lines are in i18n.sweep.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';

import { command as about } from './about';
import { command as account } from './account';
import { command as postAs } from './as';
import { command as bind } from './bind';
import { command as binds } from './binds';
import { command as close } from './close';
import { command as cw } from './cw';
import { command as desktop } from './desktop';
import { command as detach } from './detach';
import { command as display } from './display';
import { command as dm } from './dm';
import { command as dock } from './dock';
import { command as float } from './float';
import { command as focus } from './focus';
import { fakeCommandContext } from '../../test/commandContext';
import { appWithLayout, layoutHarness } from '../../test/layoutCommand';
import { markCommandMessages } from '../../test/markedLocale';
import { initialWindowsState } from '../../windows/model';
import type { CommandContext, CommandOutcome } from '../types';

/** The message {@link outcome} refuses with; empty when it succeeded. */
function refusalOf(outcome: CommandOutcome): string {
  return outcome.ok ? '' : outcome.message;
}

/** A context whose `print` is recorded, with the lines it printed. */
function printing(): {
  readonly context: CommandContext;
  readonly lines: () => readonly string[];
} {
  const print = vi.fn<CommandContext['print']>();
  return {
    context: fakeCommandContext({ print }),
    lines: () => print.mock.calls.map(([text]) => text),
  };
}

describe('the account commands in the language in use', () => {
  it('refuses /about without an instance', async () => {
    markCommandMessages();

    await expect(about.run('', fakeCommandContext())).resolves.toStrictEqual({
      ok: false,
      message: '§ Not connected. Type /connect',
    });
  });

  it.each([
    { definition: account, args: 'sideways', message: '§ Usage: § /account [list]' },
    { definition: postAs, args: '', message: '§ Usage: § /as <handle|n> <text>' },
    { definition: dm, args: '', message: '§ Usage: § /dm @user@host message' },
    { definition: cw, args: '', message: '§ Usage: /cw "warning" text' },
  ])('refuses a bad argument of /$definition.name with a marked usage line', async (row) => {
    markCommandMessages();

    const outcome = await row.definition.run(row.args, fakeCommandContext());

    expect(refusalOf(outcome)).toContain(row.message);
  });
});

describe('the key commands in the language in use', () => {
  it('refuses /bind without a chord and a line', async () => {
    markCommandMessages();

    const outcome = await bind.run('insert', fakeCommandContext());

    expect(refusalOf(outcome)).toMatch(/^§ Usage: § \/bind /u);
  });

  it('names the mode and the lack of bindings in /binds', async () => {
    markCommandMessages();
    const { context, lines } = printing();

    await binds.run('insert', context);

    expect(lines()).toStrictEqual(['§ Keys (insert mode):', '  § (none)']);
  });

  it('refuses a word that is no mode in /binds', async () => {
    markCommandMessages();

    await expect(binds.run('sideways', fakeCommandContext())).resolves.toStrictEqual({
      ok: false,
      message: '§ Not a mode: sideways. Try /binds',
    });
  });
});

describe('the window commands in the language in use', () => {
  it('refuses to close the status window', async () => {
    markCommandMessages();
    const context = fakeCommandContext({ windows: initialWindowsState() });

    await expect(close.run('', context)).resolves.toStrictEqual({
      ok: false,
      message: "§ The status window can't be closed",
    });
  });

  it('says there is nothing to prune and no last desktop to close', async () => {
    markCommandMessages();
    const { context, lines } = printing();

    await desktop.run('prune', context);
    const outcome = await desktop.run('close', context);

    expect(lines()).toStrictEqual(['§ no empty desktops']);
    expect(outcome).toStrictEqual({ ok: false, message: "§ Can't close the last desktop" });
  });

  it('echoes a bad /desktop word with the marked usage line', async () => {
    markCommandMessages();

    const outcome = await desktop.run('sideways', fakeCommandContext());

    expect(refusalOf(outcome)).toMatch(/^§ Usage: § \/desktop \[list\]/u);
  });

  it('refuses to dock and to float on an empty desktop', async () => {
    markCommandMessages();
    const harness = layoutHarness(appWithLayout({ type: 'closePane' }));

    await expect(dock.run('', harness.context())).resolves.toStrictEqual({
      ok: false,
      message: '§ The focused pane is not a float',
    });
    await expect(float.run('', harness.context())).resolves.toStrictEqual({
      ok: false,
      message: '§ There is no pane to float on this desktop',
    });
  });

  it('echoes a bad /focus word with the marked usage line', async () => {
    markCommandMessages();

    await expect(focus.run('sideways', fakeCommandContext())).resolves.toStrictEqual({
      ok: false,
      message: '§ Usage: /focus <left|right|up|down|next|prev>',
    });
  });

  it('prints the display lines and the reset in the language in use', async () => {
    markCommandMessages();
    const { context, lines } = printing();

    await display.run('', context);
    await display.run('reset', context);

    expect(lines()[0]).toMatch(/^ {2}§ density = .+ {2}\(inherited\)$/u);
    expect(lines().at(-1)).toBe('§ Display overrides cleared');
  });

  it('refuses a display key that does not exist and a bad value', async () => {
    markCommandMessages();
    const context = fakeCommandContext();

    await expect(display.run('colour', context)).resolves.toStrictEqual({
      ok: false,
      message: '§ No display key colour. Try /display',
    });
    expect(refusalOf(await display.run('density loud', context))).toMatch(/^§ density takes /u);
  });

  it('confirms /detach', async () => {
    markCommandMessages();
    const { context, lines } = printing();

    await detach.run('', context);

    expect(lines()).toStrictEqual(['§ attachments cleared']);
  });
});
