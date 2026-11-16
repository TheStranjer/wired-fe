/**
 * Tests for /compose: the definition the command line, /help, completion and
 * the keymap read — alias c, the insert-mode Ctrl+E chord and the
 * navigation-mode c chord — and that a run hands the trimmed argument text to
 * the app's composer opener, opening the box empty when there was none.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './compose';
import { fakeCommandContext } from '../../test/commandContext';
import type { CommandContext } from '../types';

/** A context whose composer opener records what it was called with. */
function openerContext(): {
  readonly context: CommandContext;
  readonly openComposer: ReturnType<typeof vi.fn>;
} {
  const openComposer = vi.fn();
  return { context: fakeCommandContext({ openComposer }), openComposer };
}

describe('/compose', () => {
  it('declares its name, alias, grammar and hotkeys', () => {
    expect(command.name).toBe('compose');
    expect(command.aliases).toStrictEqual(['c']);
    expect(command.usage).toBe('/compose [text]');
    expect(command.summary).toBe('Open the composer for a long post');
    expect(command.bindings).toStrictEqual([
      { mode: 'insert', chord: 'Ctrl+e', args: '' },
      { mode: 'navigation', chord: 'c', args: '' },
    ]);
  });

  it('opens the composer with the text it was given', async () => {
    const { context, openComposer } = openerContext();

    const outcome = await command.run('so much to say', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(openComposer).toHaveBeenCalledWith('so much to say');
  });

  it('opens an empty composer when the line carried none', async () => {
    const { context, openComposer } = openerContext();

    await expect(command.run('', context)).resolves.toStrictEqual({ ok: true });

    expect(openComposer).toHaveBeenCalledWith('');
  });

  it('trims the argument text before handing it over', async () => {
    const { context, openComposer } = openerContext();

    await command.run('  padded  ', context);

    expect(openComposer).toHaveBeenCalledWith('padded');
  });
});
