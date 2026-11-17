/**
 * Tests for collecting self-registered command definitions out of globbed
 * modules, and for loading the defs folder.
 */
import { describe, expect, it } from 'vitest';

import { collectDefinitions, loadDefinitions } from './definitions';
import type { CommandDefinition, CommandOutcome } from './types';
import { err, ok } from '../lib/result';

/** The outcome the fixture handlers report. */
const done: CommandOutcome = { ok: true };

const win: CommandDefinition = {
  name: 'win',
  aliases: ['w'],
  usage: '/win <number>',
  summary: 'Activate a window.',
  run: async () => await Promise.resolve(done),
};

const help: CommandDefinition = {
  name: 'help',
  aliases: [],
  usage: '/help',
  summary: 'List the commands.',
  run: async () => await Promise.resolve(done),
};

/** The definitions loadDefinitions collected, throwing when loading failed. */
function loaded(): readonly CommandDefinition[] {
  const result = loadDefinitions();
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

describe(collectDefinitions, () => {
  it('collects no definitions from no modules', () => {
    expect(collectDefinitions({})).toStrictEqual(ok([]));
  });

  it('collects every globbed command export, ordered by path', () => {
    const modules = {
      './defs/win.ts': win,
      './defs/help.ts': help,
    };

    expect(collectDefinitions(modules)).toStrictEqual(ok([help, win]));
  });

  it('names the path of a module without a command export', () => {
    expect(collectDefinitions({ './defs/broken.ts': undefined })).toStrictEqual(
      err('./defs/broken.ts does not export a command'),
    );
  });

  it('rejects entries that are not definitions', () => {
    const rejected = err('./defs/bad.ts does not export a command');

    expect(collectDefinitions({ './defs/bad.ts': undefined })).toStrictEqual(rejected);
    expect(collectDefinitions({ './defs/bad.ts': null })).toStrictEqual(rejected);
    expect(collectDefinitions({ './defs/bad.ts': 42 })).toStrictEqual(rejected);
    expect(collectDefinitions({ './defs/bad.ts': 'text' })).toStrictEqual(rejected);
  });

  it('rejects entries shaped like nothing a module exports', () => {
    const rejected = err('./defs/bad.ts does not export a command');

    expect(collectDefinitions({ './defs/bad.ts': {} })).toStrictEqual(rejected);
    expect(collectDefinitions({ './defs/bad.ts': () => undefined })).toStrictEqual(rejected);
  });

  it('requires a string name and a function run', () => {
    const rejected = err('./defs/x.ts does not export a command');

    expect(collectDefinitions({ './defs/x.ts': { name: 7, run: () => undefined } })).toStrictEqual(
      rejected,
    );
    expect(collectDefinitions({ './defs/x.ts': { name: 'x' } })).toStrictEqual(rejected);
    expect(collectDefinitions({ './defs/x.ts': { name: 'x', run: 'no' } })).toStrictEqual(rejected);
  });

  it('stops at the first bad path when several modules are given', () => {
    const modules = {
      './defs/b.ts': undefined,
      './defs/a.ts': 'nope',
    };

    expect(collectDefinitions(modules)).toStrictEqual(err('./defs/a.ts does not export a command'));
  });
});

describe(loadDefinitions, () => {
  it('returns the definitions collected from the defs folder as an array', () => {
    expect(loaded()).toStrictEqual(expect.any(Array));
  });
});
