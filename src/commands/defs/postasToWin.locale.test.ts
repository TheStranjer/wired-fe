/**
 * Tests that the summary and usage of the commands `/postas` through `/win`
 * come from the message catalog (decision 19, WFE-315): with a fake language
 * installed every one reads its words from it, so the getters, not literals,
 * are what /help and completion show.
 */
import { describe, expect, it } from 'vitest';

import { command as postas } from './postas';
import { command as query } from './query';
import { command as quote } from './quote';
import { command as raise } from './raise';
import { command as react } from './react';
import { command as reply } from './reply';
import { command as resize } from './resize';
import { command as search } from './search';
import { command as select } from './select';
import { command as set } from './set';
import { command as split } from './split';
import { command as start } from './start';
import { command as swap } from './swap';
import { command as sync } from './sync';
import { command as tag } from './tag';
import { command as theme } from './theme';
import { command as thread } from './thread';
import { command as unbind } from './unbind';
import { command as unblock } from './unblock';
import { command as unbookmark } from './unbookmark';
import { command as unboost } from './unboost';
import { command as unfav } from './unfav';
import { command as unfollow } from './unfollow';
import { command as unmute } from './unmute';
import { command as unpin } from './unpin';
import { command as unreact } from './unreact';
import { command as unsplit } from './unsplit';
import { command as vis } from './vis';
import { command as vote } from './vote';
import { command as vsplit } from './vsplit';
import { command as whois } from './whois';
import { command as win } from './win';
import type { Messages } from '../../i18n/messages';
import { installFakeLocale } from '../../test/i18n';
import { VIEW_USAGE } from '../splitRun';
import type { CommandDefinition } from '../types';

/** Commands whose usage is a bare `/name`, with no words to translate. */
const BARE_USAGE: readonly CommandDefinition[] = [raise, start, unsplit];

/** Commands whose usage takes the list of views as an argument. */
const VIEW_USAGE_COMMANDS: readonly CommandDefinition[] = [split, vsplit];

/** Every command of the sweep whose usage is its own message. */
const WORDED_USAGE: readonly CommandDefinition[] = [
  postas,
  query,
  quote,
  react,
  reply,
  resize,
  search,
  select,
  set,
  swap,
  sync,
  tag,
  theme,
  thread,
  unbind,
  unblock,
  unbookmark,
  unboost,
  unfav,
  unfollow,
  unmute,
  unpin,
  unreact,
  vis,
  vote,
  whois,
  win,
];

/** Every command the sweep covers. */
const ALL: readonly CommandDefinition[] = [...BARE_USAGE, ...VIEW_USAGE_COMMANDS, ...WORDED_USAGE];

/** A catalog giving every command of {@link ALL} a summary and usage of its own. */
function catalog(): Messages {
  const defs: Record<string, Messages> = {};
  for (const { name } of ALL) {
    const views = VIEW_USAGE_COMMANDS.some((command) => command.name === name) ? ' {views}' : '';
    defs[name] = { summary: `summary of ${name}`, usage: `usage of ${name}${views}` };
  }
  return { commands: { defs } };
}

describe('commands /postas through /win in another language', () => {
  it.each(ALL.map((command) => [command.name, command] as const))(
    'reads the summary of /%s from the catalog',
    (name, command) => {
      installFakeLocale(catalog());

      expect(command.summary).toBe(`summary of ${name}`);
    },
  );

  it.each(WORDED_USAGE.map((command) => [command.name, command] as const))(
    'reads the usage of /%s from the catalog',
    (name, command) => {
      installFakeLocale(catalog());

      expect(command.usage).toBe(`usage of ${name}`);
    },
  );

  it.each(VIEW_USAGE_COMMANDS.map((command) => [command.name, command] as const))(
    'puts the views into the usage of /%s',
    (name, command) => {
      installFakeLocale(catalog());

      expect(command.usage).toBe(`usage of ${name} ${VIEW_USAGE}`);
    },
  );

  it.each(BARE_USAGE.map((command) => [command.name, command] as const))(
    'keeps the usage of /%s as the bare command',
    (name, command) => {
      installFakeLocale(catalog());

      expect(command.usage).toBe(`/${name}`);
    },
  );
});
