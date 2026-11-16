/**
 * Tests for /attach: the definition the command line, /help and completion
 * read — alias att — and that a run hands the trimmed argument text to the
 * app's picker as the alt description, opening the dialog empty when there
 * was none.
 */
import { describe, expect, it, vi } from 'vitest';

import { command } from './attach';
import { fakeCommandContext } from '../../test/commandContext';
import type { CommandContext } from '../types';

/** A context whose picker records the descriptions it was opened with. */
function pickerContext(): {
  readonly context: CommandContext;
  readonly pick: ReturnType<typeof vi.fn>;
} {
  const pick = vi.fn();
  return {
    context: fakeCommandContext({ attachments: { pick, clear: vi.fn(), pending: [] } }),
    pick,
  };
}

describe('/attach', () => {
  it('declares its name, alias and grammar', () => {
    expect(command.name).toBe('attach');
    expect(command.aliases).toStrictEqual(['att']);
    expect(command.usage).toBe('/attach [alt text]');
    expect(command.summary).toBe('Attach media to your next post');
  });

  it('opens the picker with the alt text it was given', async () => {
    const { context, pick } = pickerContext();

    const outcome = await command.run('a wall at night', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(pick).toHaveBeenCalledWith('a wall at night');
  });

  it('trims the argument text before handing it over', async () => {
    const { context, pick } = pickerContext();

    await command.run('  padded  ', context);

    expect(pick).toHaveBeenCalledWith('padded');
  });

  it('opens the picker undescribed when the line carried none', async () => {
    const { context, pick } = pickerContext();

    await expect(command.run('', context)).resolves.toStrictEqual({ ok: true });

    expect(pick).toHaveBeenCalledWith('');
  });
});
