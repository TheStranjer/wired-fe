/**
 * `/forgot <email|nick> [instance]` (decision 6, WFE-163): ask the instance to
 * mail a password-reset letter. It needs no login. The argument is an e-mail
 * address when it is `name@host` and a nickname otherwise (a leading `@`, as
 * in `@lain` or `@lain@wired.example`, marks a nickname and drops the host).
 * The instance is the one named after the target, else the active account's,
 * else the build's own (decision 3). Whatever the instance answers — success
 * or refusal — the command prints the same line, so the answer never says
 * whether the account exists. The letter's link opens the new-password box
 * (`#/password_reset/<token>`).
 */

import { type OriginChoice, resolveInstanceOrigin } from '../../accounts/origin';
import { type ResetTarget, requestPasswordReset } from '../../api/endpoints/passwordReset';
import { ok } from '../../lib/result';
import { activeAccount } from '../../state/selectors';
import { OK, fail } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** What the command prints, whatever the instance answered. */
const LETTER_MESSAGE = 'If that account exists, a reset letter is on its way.';

/** Shown when no account was named. */
const USAGE = 'Usage: /forgot <email|nick>';

/** An e-mail address: one `@` with something on each side, no spaces. */
const EMAIL = /^[^@\s]+@[^@\s]+$/u;

/** The account {@link typed} names: an e-mail address, else a nickname without `@` or host. */
function targetOf(typed: string): ResetTarget {
  if (EMAIL.test(typed)) {
    return { email: typed };
  }
  const nickname = typed.startsWith('@') ? (typed.slice(1).split('@')[0] ?? '') : typed;
  return { nickname };
}

/** The instance to ask: the typed one, else the active account's, else the build's own. */
function instanceFor(typed: string, context: CommandContext): OriginChoice {
  const account = activeAccount(context.state);
  if (typed === '' && account !== null) {
    return ok(account.origin);
  }
  return resolveInstanceOrigin(context.config.instances, context.page.origin, typed);
}

/** Ask for the letter and print the one answer, or say what is missing to ask. */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const [typed = '', instanceArg = ''] = args.trim().split(/\s+/u);
  const target = targetOf(typed);
  if ('nickname' in target && target.nickname === '') {
    return fail(USAGE);
  }
  const instance = instanceFor(instanceArg, context);
  if (!instance.ok) {
    return fail(instance.error);
  }
  await requestPasswordReset(instance.value, target);
  context.print(LETTER_MESSAGE);
  return OK;
}

/** The `/forgot` (alias `/resetpw`) definition. */
export const command: CommandDefinition = {
  name: 'forgot',
  aliases: ['resetpw'],
  usage: '/forgot <email|nick> [instance]',
  summary: 'Mail a password-reset letter',
  run: handle,
};
