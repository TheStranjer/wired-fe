/**
 * `/whois [target]` (aliases `/wi` and `/profile`; decision 6, AGENTS.md
 * "Windows, like IRC buffers"): open an account's profile window, the way
 * IRC's `/whois` answers *about* somebody. The target resolves like the other
 * account commands' (src/commands/targets): a first word carrying an `@` is a
 * handle the instance looks up, a post label names that post's author, and
 * otherwise the navigation selection's author stands — so `w` in navigation
 * mode whois's the post you are looking at. The window shows the account's
 * whois block above its posts (src/features/profile); opening the same
 * account twice activates the window that already shows it. Whatever the
 * resolver refuses — no account, no such handle, nothing selected — is what
 * the command says back.
 */

import { profileWindowOpen } from '../../state/profileWindow';
import { placedRun } from '../openWindowRun';
import { OK, fail } from '../outcome';
import { resolveAccountTarget } from '../targets';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** Resolve the account, then ask the window list for its profile window. */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const target = await resolveAccountTarget(args, context);
  if (!target.ok) {
    return fail(target.error);
  }
  const { account, accountKey } = target.value;
  context.dispatchWindows(profileWindowOpen(account, accountKey));
  return OK;
}

/** The `/whois` (aliases `/wi`, `/profile`) definition. */
export const command: CommandDefinition = {
  name: 'whois',
  aliases: ['wi', 'profile'],
  usage: '/whois [label | @user@host]',
  summary: "Open an account's profile window",
  run: placedRun(handle),
  bindings: [{ mode: 'navigation', chord: 'w', args: '' }],
};
