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

  it('collects the command export of every module, ordered by path', () => {
    const modules = {
      './defs/win.ts': { command: win },
      './defs/help.ts': { command: help },
    };

    expect(collectDefinitions(modules)).toStrictEqual(ok([help, win]));
  });

  it('names the path of a module without a command export', () => {
    expect(collectDefinitions({ './defs/broken.ts': { notCommand: 1 } })).toStrictEqual(
      err('./defs/broken.ts does not export a command'),
    );
  });

  it('rejects modules that are not objects', () => {
    const rejected = err('./defs/bad.ts does not export a command');

    expect(collectDefinitions({ './defs/bad.ts': undefined })).toStrictEqual(rejected);
    expect(collectDefinitions({ './defs/bad.ts': null })).toStrictEqual(rejected);
    expect(collectDefinitions({ './defs/bad.ts': 42 })).toStrictEqual(rejected);
    expect(collectDefinitions({ './defs/bad.ts': 'text' })).toStrictEqual(rejected);
  });

  it('rejects command exports that are not objects', () => {
    const rejected = err('./defs/bad.ts does not export a command');

    expect(collectDefinitions({ './defs/bad.ts': { command: undefined } })).toStrictEqual(rejected);
    expect(collectDefinitions({ './defs/bad.ts': { command: null } })).toStrictEqual(rejected);
    expect(collectDefinitions({ './defs/bad.ts': { command: 42 } })).toStrictEqual(rejected);
    expect(collectDefinitions({ './defs/bad.ts': { command: 'text' } })).toStrictEqual(rejected);
    expect(collectDefinitions({ './defs/bad.ts': { command: () => undefined } })).toStrictEqual(
      rejected,
    );
  });

  it('requires a string name and a function run', () => {
    const rejected = err('./defs/x.ts does not export a command');

    expect(
      collectDefinitions({ './defs/x.ts': { command: { name: 7, run: () => undefined } } }),
    ).toStrictEqual(rejected);
    expect(collectDefinitions({ './defs/x.ts': { command: { name: 'x' } } })).toStrictEqual(
      rejected,
    );
    expect(
      collectDefinitions({ './defs/x.ts': { command: { name: 'x', run: 'no' } } }),
    ).toStrictEqual(rejected);
  });

  it('stops at the first bad path when several modules are given', () => {
    const modules = {
      './defs/b.ts': {},
      './defs/a.ts': { command: 'nope' },
    };

    expect(collectDefinitions(modules)).toStrictEqual(err('./defs/a.ts does not export a command'));
  });
});

describe(loadDefinitions, () => {
  it('returns the definitions collected from the defs folder as an array', () => {
    expect(loaded()).toStrictEqual(expect.any(Array));
  });
});
