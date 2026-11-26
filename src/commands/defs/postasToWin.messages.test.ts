/**
 * Tests that what `/postas` through `/win` print and refuse with comes from
 * the message catalog (decision 19, WFE-315): with a fake language installed
 * each message appears in the fake words, with its arguments filled in.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { command as postas } from './postas';
import { command as query } from './query';
import { command as resize } from './resize';
import { command as search } from './search';
import { command as select } from './select';
import { command as set } from './set';
import { command as swap } from './swap';
import { command as sync } from './sync';
import { command as tag } from './tag';
import { command as theme } from './theme';
import { command as unbind } from './unbind';
import { command as vis } from './vis';
import { command as win } from './win';
import type { Messages } from '../../i18n/messages';
import { fakeCommandContext } from '../../test/commandContext';
import { installFakeLocale } from '../../test/i18n';
import { STATUS_WINDOW_ID, initialWindowsState, windowId } from '../../windows/model';
import { windowsReducer } from '../../windows/reducer';
import type { CommandContext, CommandDefinition } from '../types';

/** A context whose print is a recording mock. */
function printing(overrides: Partial<CommandContext> = {}): {
  readonly context: CommandContext;
  readonly print: Mock<CommandContext['print']>;
} {
  const print: Mock<CommandContext['print']> = vi.fn();
  return { context: fakeCommandContext({ print, ...overrides }), print };
}

/** The lines a mock `print` recorded. */
function lines(print: Mock<CommandContext['print']>): readonly string[] {
  return print.mock.calls.map(([text]) => text);
}

/** A catalog giving one command the fake {@link entries}. */
function defs(name: string, entries: Messages): Messages {
  return { commands: { defs: { [name]: entries } } };
}

describe('usage refusals in another language', () => {
  const FORMS: readonly (readonly [CommandDefinition, string])[] = [
    [postas, '--bogus'],
    [query, ''],
    [resize, 'sideways'],
    [search, ''],
    [select, ''],
    [set, 'theme wired extra'],
    [swap, ''],
    [sync, 'bogus'],
    [theme, 'a b'],
    [unbind, ''],
    [vis, 'bogus'],
    [win, 'bogus'],
  ];

  it.each(FORMS.map(([command, args]) => [command.name, command, args] as const))(
    'says it in the words of the catalog for /%s',
    async (name, command, args) => {
      installFakeLocale(defs(name, { usage: `form of ${name}`, usage_error: 'USAGE! {usage}' }));
      const { context } = printing();

      const outcome = await command.run(args, context);

      expect(outcome).toStrictEqual({ ok: false, message: `USAGE! form of ${name}` });
    },
  );
});

describe('/theme in another language', () => {
  it('prints the header and tags the current theme in the words of the catalog', async () => {
    installFakeLocale(defs('theme', { list_header: 'THEMES', current: '* {name} NOW' }));
    const { context, print } = printing();

    await theme.run('', context);

    expect(lines(print)).toStrictEqual(['THEMES', '* wired NOW', '  lain', '  bnet']);
  });

  it('refuses a word that names no theme in the words of the catalog', async () => {
    installFakeLocale(defs('theme', { no_theme: 'NO THEME {name}' }));
    const { context } = printing();

    await expect(theme.run('nope', context)).resolves.toStrictEqual({
      ok: false,
      message: 'NO THEME nope',
    });
  });
});

describe('/win in another language', () => {
  const CATALOG = defs('win', {
    cannot_move: 'NO MOVE',
    no_window: 'NO WINDOW {number}',
    unread: ' [{count, plural, one {{count} U} other {{count} US}}]',
  });

  /** Status and home, status in front, with home holding {@link count} unread. */
  function withUnread(count: number): Partial<CommandContext> {
    const home = { kind: 'home', accountKey: 'lain@wired.example', target: null } as const;
    const opened = windowsReducer(initialWindowsState(), {
      type: 'open',
      ref: home,
      title: 'home',
    });
    const back = windowsReducer(opened, { type: 'activate', id: STATUS_WINDOW_ID });
    const windows = windowsReducer(back, {
      type: 'markUnread',
      id: windowId(home),
      count,
      highlight: false,
    });
    return { windows };
  }

  it('lists the unread count in the words of the catalog', async () => {
    installFakeLocale(CATALOG);
    const { context, print } = printing(withUnread(3));

    await win.run('list', context);

    expect(lines(print)).toStrictEqual(['> 1: status', '  2: home [3 US]']);
  });

  it('refuses a missing window and a move that cannot be done in the words of the catalog', async () => {
    installFakeLocale(CATALOG);
    const { context } = printing(withUnread(1));

    await expect(win.run('9', context)).resolves.toStrictEqual({
      ok: false,
      message: 'NO WINDOW 9',
    });
    await expect(win.run('move 9', context)).resolves.toStrictEqual({
      ok: false,
      message: 'NO MOVE',
    });
  });
});

describe('the other commands in another language', () => {
  it('refuses a word that is no hashtag', async () => {
    installFakeLocale(defs('tag', { not_a_hashtag: 'NOT A TAG {input}' }));
    const { context } = printing();

    await expect(tag.run(' !! ', context)).resolves.toStrictEqual({
      ok: false,
      message: 'NOT A TAG !!',
    });
  });

  it('refuses a chord that is no key and says what it unbound', async () => {
    installFakeLocale(
      defs('unbind', { not_a_key: 'NOT A KEY {chord}', unbound: 'GONE {mode} {chord}' }),
    );
    const refused = printing({ keys: { ...fakeCommandContext().keys, parseChord: () => null } });
    const accepted = printing();

    await expect(unbind.run('insert banana', refused.context)).resolves.toStrictEqual({
      ok: false,
      message: 'NOT A KEY banana',
    });

    await unbind.run('insert F2', accepted.context);

    expect(lines(accepted.print)).toStrictEqual(['GONE insert F2']);
  });

  it('prints a setting, refuses an unknown one and a value it does not take', async () => {
    installFakeLocale(
      defs('set', {
        listed: 'SETTING {key}={value}: {description}',
        no_setting: 'NO SETTING {key}',
        takes: 'TAKES {key} {words}',
      }),
    );
    const { context, print } = printing();

    await set.run('theme', context);
    const unknown = await set.run('nope', context);
    const refused = await set.run('theme nope', context);

    expect(lines(print)).toStrictEqual(['SETTING theme=wired: The colors the shell is painted in']);
    expect(unknown).toStrictEqual({ ok: false, message: 'NO SETTING nope' });
    expect(refused).toStrictEqual({ ok: false, message: 'TAKES theme wired|lain|bnet' });
  });

  it('says the default audience and the posting account it cleared', async () => {
    installFakeLocale({
      commands: {
        defs: {
          postas: { global_cleared: 'CLEARED' },
          vis: { report: 'NEW POSTS {visibility}' },
        },
      },
    });
    const { context, print } = printing();

    await vis.run('', context);
    await postas.run('--clear', context);

    expect(lines(print)).toStrictEqual(['NEW POSTS public', 'CLEARED']);
  });

  it('says sync is on and that no account can hold the desk', async () => {
    installFakeLocale(defs('sync', { no_holder: 'NO HOLDER', switched_on: 'SYNC ON' }));
    const { context, print } = printing();

    await sync.run('on', context);
    const outcome = await sync.run('now', context);

    expect(lines(print)).toStrictEqual(['SYNC ON']);
    expect(outcome).toStrictEqual({ ok: false, message: 'NO HOLDER' });
  });
});
