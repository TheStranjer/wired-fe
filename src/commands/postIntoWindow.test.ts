/**
 * Tests for the media gate of the text a command posts into the window it
 * opened (WFE-290, WFE-294): a cancelled alt-text review is the reader's own
 * choice, so it posts nothing, says nothing and keeps the pending media; a
 * refused description fails with its reason and keeps them too.
 */
import { describe, expect, it, vi } from 'vitest';

import { postIntoWindow } from './postIntoWindow';
import type { CommandContext } from './types';
import { fakeAttachments, fakeCommandContext } from '../test/commandContext';

/** What the poster is asked to post as. */
const TARGET = { accountKey: 'https://wired.example#1', windowId: 'home' };

/** Runs the text through a poster that records its calls, with the gate answering {@link carried}. */
async function run(carried: Awaited<ReturnType<CommandContext['carryMedia']>>) {
  const poster = vi.fn().mockResolvedValue(null);
  const clear = vi.fn();
  const context = fakeCommandContext({
    attachments: fakeAttachments({ pending: ['12'], clear }),
    carryMedia: vi.fn<CommandContext['carryMedia']>().mockResolvedValue(carried),
  });
  const outcome = await postIntoWindow(context, { ...TARGET, poster }, 'sup');
  return { outcome, poster, clear, context };
}

describe(postIntoWindow, () => {
  it('posts nothing, says nothing and keeps the pending media when the review is cancelled', async () => {
    const { outcome, poster, clear, context } = await run({ kind: 'cancelled' });

    expect(outcome).toStrictEqual({ ok: true });
    expect(poster).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(context.print).not.toHaveBeenCalled();
  });

  it('fails with the reason and keeps the pending media when the alt text is refused', async () => {
    const { outcome, poster, clear } = await run({ kind: 'refused', error: 'no alt' });

    expect(outcome).toStrictEqual({ ok: false, message: 'no alt' });
    expect(poster).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });
});
