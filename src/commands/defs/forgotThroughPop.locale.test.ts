/**
 * Tests that the command definitions /forgot through /pop go through `t()`
 * (decision 19, WFE-314): each summary and usage reads the language in use
 * when it is asked for, and the messages the commands print or refuse with
 * come from the catalog of the fake test language.
 */
import { type Mock, describe, expect, it, vi } from 'vitest';

import { command as forgot } from './forgot';
import { command as help } from './help';
import { command as home } from './home';
import { command as local } from './local';
import { command as media } from './media';
import { command as more } from './more';
import { command as mute } from './mute';
import { command as mvd } from './mvd';
import { command as notifications } from './notifications';
import { command as only } from './only';
import { command as open } from './open';
import { command as people } from './people';
import { command as pin } from './pin';
import { command as poll } from './poll';
import { command as pop } from './pop';
import { fakeCommandContext } from '../../test/commandContext';
import { installFakeLocale } from '../../test/i18n';
import type { CommandContext, CommandDefinition } from '../types';

/** The sixteen commands under test, by name. */
const DEFINITIONS: readonly CommandDefinition[] = [
  forgot,
  help,
  home,
  local,
  media,
  more,
  mute,
  mvd,
  notifications,
  only,
  open,
  people,
  pin,
  poll,
  pop,
];

/** A catalog giving every command's summary and usage an `XX` text. */
function fakeCatalog(): Record<string, Record<string, string>> {
  return Object.fromEntries(
    DEFINITIONS.map((definition) => [
      definition.name,
      { summary: `XX ${definition.name} summary`, usage: `XX ${definition.name} usage` },
    ]),
  );
}

/** A context whose print is a recording mock. */
function printing(): { context: CommandContext; print: Mock<CommandContext['print']> } {
  const print: Mock<CommandContext['print']> = vi.fn();
  return { context: fakeCommandContext({ print }), print };
}

describe('commands /forgot through /pop in another language', () => {
  it('read their summary from the language in use', () => {
    installFakeLocale({ commands: { defs: fakeCatalog() } });

    expect(DEFINITIONS.map((definition) => definition.summary)).toStrictEqual(
      DEFINITIONS.map((definition) => `XX ${definition.name} summary`),
    );
  });

  it('read their usage from the language in use, except those with nothing to translate', () => {
    installFakeLocale({ commands: { defs: fakeCatalog() } });

    const translated = DEFINITIONS.filter((definition) => definition.usage.startsWith('XX'));

    expect(translated.map((definition) => definition.name)).toStrictEqual([
      'forgot',
      'help',
      'home',
      'local',
      'media',
      'mute',
      'mvd',
      'notifications',
      'open',
      'pin',
      'poll',
      'pop',
    ]);
  });

  it('keep their English text with no other language installed', () => {
    expect(mvd.usage).toBe('/mvd <number> [follow]');
    expect(poll.usage).toBe(
      '/poll "<question>" "<option>" "<option>" [...] [--multiple] [--hours N]',
    );
    expect(forgot.summary).toBe('Mail a password-reset letter');
  });

  it('refuses /forgot with no account named in the language in use', async () => {
    installFakeLocale({ commands: { defs: { forgot: { usage_error: 'XX forgot usage' } } } });

    const outcome = await forgot.run('@', fakeCommandContext());

    expect(outcome).toStrictEqual({ ok: false, message: 'XX forgot usage' });
  });

  it('prints the /help header, footer and topics in the language in use', async () => {
    installFakeLocale({
      commands: {
        defs: {
          help: {
            footer: 'XX footer',
            header: 'XX header',
            topics: 'XX topics {topics}',
          },
        },
      },
    });
    const { context, print } = printing();

    await help.run('', context);

    expect(print.mock.calls.map(([line]) => line)).toStrictEqual([
      'XX header',
      'XX footer',
      expect.stringMatching(/^XX topics \w/u),
    ]);
  });

  it('refuses an unknown /help subject in the language in use', async () => {
    installFakeLocale({ commands: { defs: { help: { no_such_command: 'XX none {subject}' } } } });

    const outcome = await help.run('nope', fakeCommandContext());

    expect(outcome).toStrictEqual({ ok: false, message: 'XX none nope' });
  });

  it('refuses /mvd, /open and /poll in the language in use', async () => {
    installFakeLocale({
      commands: {
        defs: {
          mvd: { usage_error: 'XX mvd usage' },
          open: { not_http: 'XX not http' },
          poll: { usage_error: 'XX poll usage' },
        },
      },
    });
    const context = fakeCommandContext();

    await expect(mvd.run('x', context)).resolves.toStrictEqual({
      ok: false,
      message: 'XX mvd usage',
    });
    await expect(open.run('javascript:alert(1)', context)).resolves.toStrictEqual({
      ok: false,
      message: 'XX not http',
    });
    await expect(poll.run('', context)).resolves.toStrictEqual({
      ok: false,
      message: 'XX poll usage',
    });
  });
});
