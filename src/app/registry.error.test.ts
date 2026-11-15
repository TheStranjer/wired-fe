/**
 * The failure paths the real defs folder cannot show: a command module that
 * exports no command, and two commands sharing one name, both reach the shell
 * as the reason the registry could not be built. Each test answers through the
 * shared holder and re-imports the module, so the one lazy value is computed
 * again over the answer under test.
 */
import { describe, expect, it, vi } from 'vitest';

import type { CommandDefinition, CommandOutcome, Registry } from '../commands/types';
import type { Result } from '../lib/result';

/** What the mocked loader hands out; every test sets it before importing. */
const LOADED = vi.hoisted((): { result: Result<readonly CommandDefinition[], string> } => ({
  result: { ok: true, value: [] },
}));

vi.mock(import('../commands/definitions'), () => ({
  loadDefinitions: () => LOADED.result,
}));

/** A command the registry accepts, named {@link name}. */
function command(name: string): CommandDefinition {
  const done: CommandOutcome = { ok: true };
  return {
    aliases: [],
    name,
    run: async () => await Promise.resolve(done),
    summary: name,
    usage: `/${name}`,
  };
}

/** A fresh appRegistry reading {@link result} as the loader's answer. */
async function registryFrom(
  result: Result<readonly CommandDefinition[], string>,
): Promise<Result<Registry, string>> {
  LOADED.result = result;
  vi.resetModules();
  const { appRegistry } = await import('./registry');
  return appRegistry();
}

describe('appRegistry when the commands cannot be loaded', () => {
  it('passes a definition file with no command through as the error', async () => {
    const built = await registryFrom({ ok: false, error: './defs/x.ts does not export a command' });

    expect(built).toStrictEqual({ ok: false, error: './defs/x.ts does not export a command' });
  });

  it('reports the clash that stopped the registry from being built', async () => {
    const built = await registryFrom({ ok: true, value: [command('win'), command('win')] });

    expect(built).toStrictEqual({
      ok: false,
      error: 'Duplicate name: /win (already used by /win)',
    });
  });
});
