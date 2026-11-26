/**
 * The i18n sweep of the commands `/about` through `/follow` (WFE-313,
 * decision 19): every summary and usage line of them comes from the catalog
 * through a getter. The fake language marks every message of `commands.defs`
 * with `§ `, so a string without the mark is still a literal. What the
 * commands print and refuse with is in i18n.run.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { command as about } from './about';
import { command as account } from './account';
import { command as postAs } from './as';
import { command as attach } from './attach';
import { command as bind } from './bind';
import { command as binds } from './binds';
import { command as block } from './block';
import { command as bookmark } from './bookmark';
import { command as boost } from './boost';
import { command as clear } from './clear';
import { command as close } from './close';
import { command as compose } from './compose';
import { command as connect } from './connect';
import { command as copy } from './copy';
import { command as cw } from './cw';
import { command as remove } from './delete';
import { command as desktop } from './desktop';
import { command as detach } from './detach';
import { command as display } from './display';
import { command as dm } from './dm';
import { command as dock } from './dock';
import { command as edit } from './edit';
import { command as equalize } from './equalize';
import { command as fav } from './fav';
import { command as federated } from './federated';
import { command as feed } from './feed';
import { command as float } from './float';
import { command as focus } from './focus';
import { command as follow } from './follow';
import { markCommandMessages } from '../../test/markedLocale';
import type { CommandDefinition } from '../types';

/** Every command of the sweep: each has a translated summary. */
const COMMANDS: readonly CommandDefinition[] = [
  about,
  account,
  postAs,
  attach,
  bind,
  binds,
  block,
  bookmark,
  boost,
  clear,
  close,
  compose,
  connect,
  copy,
  cw,
  remove,
  desktop,
  detach,
  display,
  dm,
  dock,
  edit,
  equalize,
  fav,
  federated,
  feed,
  float,
  focus,
  follow,
];

/** The commands whose usage spells only literal words, so it is not translated. */
const LITERAL_USAGES: readonly string[] = [
  'about',
  'binds',
  'clear',
  'close',
  'detach',
  'dock',
  'equalize',
  'float',
  'focus',
];

/** The commands whose usage has words to translate. */
const WORDED_USAGES: readonly CommandDefinition[] = COMMANDS.filter(
  ({ name }) => !LITERAL_USAGES.includes(name),
);

describe('the sweep of /about through /follow', () => {
  it('keeps every summary and usage in English by default', () => {
    expect(about.summary).toBe('Show what this instance is and can do');
    expect(desktop.usage).toContain('/desktop <number>');
    expect(feed.usage).toContain('/feed add|rm <name> <source>…');
  });

  it.each(COMMANDS)('reads the summary of /$name in the language in use', (definition) => {
    markCommandMessages();

    expect(definition.summary).toMatch(/^§ ./u);
  });

  it.each(WORDED_USAGES)('reads the usage of /$name in the language in use', (definition) => {
    markCommandMessages();

    expect(definition.usage).toMatch(/^§ \//u);
  });
});
