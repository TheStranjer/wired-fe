/**
 * Tests for commands in a signed-out window (WFE-340, decision 6): every
 * command that acts on a post or an account of a window read under an
 * `anon:<origin>` key refuses with the one shared "sign in" message — typed
 * with a label, or on the post the navigation selection stands on, which is
 * what a hotkey runs — and sends no request (MSW fails any request no handler
 * answers). A command that only reads still works.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { command as bookmark } from './bookmark';
import { command as boost } from './boost';
import { command as copy } from './copy';
import { command as del } from './delete';
import { command as edit } from './edit';
import { command as fav } from './fav';
import { command as follow } from './follow';
import { command as quote } from './quote';
import { command as react } from './react';
import { command as reply } from './reply';
import { anonContext } from '../../test/anonWindow';
import { status } from '../../test/fixtures';
import type { CommandDefinition } from '../types';

const SIGN_IN = 'Sign in to do that: this window is read-only. Type /connect to log in.';

/** The commands that act as an account. */
const ACTING: readonly CommandDefinition[] = [
  fav,
  boost,
  reply,
  quote,
  react,
  edit,
  del,
  bookmark,
  follow,
];

describe('commands that act, in a signed-out window', () => {
  it.each(ACTING)(
    '/$name refuses a label with the sign-in message and sends nothing',
    async (command) => {
      const context = anonContext([status('p')]);

      const outcome = await command.run('a0', context);

      expect(outcome).toStrictEqual({ ok: false, message: SIGN_IN });
      expect(context.dispatch).not.toHaveBeenCalled();
    },
  );

  it.each(ACTING)('/$name refuses the selected post, as its hotkey runs it', async (command) => {
    const context = anonContext([status('p')], 'p');

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: false, message: SIGN_IN });
  });
});

describe('a command that only reads, in a signed-out window', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  });

  it('still works: /copy puts the link of the post on the clipboard', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const context = anonContext([status('p')]);

    const outcome = await copy.run('a0', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(writeText).toHaveBeenCalledExactlyOnceWith(expect.any(String));
  });
});
