/**
 * Tests that the command layer's own text follows the language in use
 * (WFE-316, decision 19): the parse and dispatch errors, the shared refusals,
 * the detail block's labels, the help topic paragraphs, the usage and refusal
 * sentences and the post-toggle words all come from the catalog, so a fake
 * language replaces them.
 */
import { describe, expect, it } from 'vitest';

import type { Keymap } from './bindingTypes';
import { commandDetailLines, commandTip } from './commandDetail';
import { desktopLines } from './desktopList';
import { desktopNumber } from './desktopNumber';
import { feedUsage } from './feedArgs';
import { adjustFloat } from './floatAdjust';
import { lookupTopic } from './helpTopics';
import { NOT_LOGGED_IN, fail } from './outcome';
import { parseInput } from './parseInput';
import type { CommandDefinition, CommandOutcome } from './types';
import { parseViewSpec } from './viewSpec';
import { fakeCommandContext } from '../test/commandContext';
import { installFakeLocale } from '../test/i18n';
import { initialDesktops } from '../windows/desktops';
import { initialWindowsState } from '../windows/model';

/** A command with an alias, to show the detail block's labels. */
const ALIASED: CommandDefinition = {
  name: 'float',
  aliases: ['fl'],
  usage: '/float',
  summary: 'Float it',
  run: async (): Promise<CommandOutcome> => await Promise.resolve({ ok: true }),
};

describe('the command layer in another language', () => {
  it('words the parse errors from the catalog', () => {
    installFakeLocale({ commands: { missing_name: 'XX no name', invalid_name: 'XX bad /{name}' } });

    expect(parseInput('/')).toStrictEqual({ kind: 'invalid', reason: 'XX no name' });
    expect(parseInput('/a_b')).toStrictEqual({ kind: 'invalid', reason: 'XX bad /a_b' });
  });

  it('words the not-logged-in refusal when it is read, not when it was made', () => {
    expect(NOT_LOGGED_IN).toStrictEqual({ ok: false, message: 'Not logged in. Type /connect' });

    installFakeLocale({ commands: { not_logged_in: 'XX sign in' } });

    expect(NOT_LOGGED_IN).toStrictEqual({ ok: false, message: 'XX sign in' });
  });

  it('labels the aliases and the keys of a command in the detail block', () => {
    installFakeLocale({
      commands: {
        aliases: 'XX aka {aliases}',
        keys: 'XX keys {keys}',
        key_in_mode: '{chord} [{mode}]',
        tip: 'XX {action} /{command}',
        tip_keys: 'XX {action} /{command} <{keys}>',
      },
    });
    const keymap: Keymap = {
      insert: new Map([['Alt+f', { line: '/float', prefill: false }]]),
      navigation: new Map(),
      problems: [],
    };

    expect(commandDetailLines(ALIASED, keymap)).toStrictEqual([
      '/float',
      '  Float it',
      '  XX aka /fl',
      '  XX keys Alt+f [insert]',
    ]);

    const registry = { commands: [ALIASED], byName: new Map([['float', ALIASED]]) };

    expect(commandTip('Go', 'float', { registry, keymap })).toBe('XX Go /float <Alt+f>');
    expect(commandTip('Go', 'other', { registry, keymap })).toBe('XX Go /other');
  });

  it('reads a help topic paragraph from the catalog each time it is asked', () => {
    installFakeLocale({ commands: { help_topics: { sync: 'XX sync {handle}' } } });

    expect(lookupTopic('sync')?.text).toBe('XX sync <handle>');
  });

  it('words the usage and refusal sentences from the catalog', () => {
    installFakeLocale({
      commands: {
        usage: 'XX use {usage}',
        not_a_float: 'XX not a float',
        desktops_up_to: 'XX up to {max}',
        view_win_number: 'XX win number',
      },
    });
    const context = fakeCommandContext();

    expect(feedUsage('edit <name>')).toStrictEqual(fail('XX use /feed edit <name>'));
    expect(adjustFloat(context, 'move', [])).toStrictEqual(
      fail('XX use /float move <dx> <dy> | size <dw> <dh>'),
    );
    expect(adjustFloat(context, 'move', ['1', '1'])).toStrictEqual(fail('XX not a float'));
    expect(desktopNumber('5000', fail('unusable'))).toStrictEqual(fail('XX up to 1000'));
    expect(parseViewSpec('win x')).toStrictEqual({ ok: false, error: 'XX win number' });
  });

  it('words the desktop listing with a plural from the catalog', () => {
    installFakeLocale({
      commands: {
        desktop_line_titles: '{label} = {count, plural, one {# P} other {# Ps}} / {titles}',
      },
    });

    expect(desktopLines(initialDesktops('status'), initialWindowsState())).toStrictEqual([
      '* 1 = 1 P / status',
    ]);
  });
});
