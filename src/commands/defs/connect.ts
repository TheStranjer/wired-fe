/**
 * `/connect` (decision 6, decision 8): start an OAuth login. Which instance is
 * the build's to say (decision 3): a `same-origin` or `fixed` build logs into
 * its own backend and ignores the argument, a `list` build takes one of its
 * options (or, with `allowCustom`, anything typed) and an `open` build, the
 * same as an empty `allowCustom` list, whatever the user typed — `wired.example`,
 * `https://wired.example` or `@lain@wired.example` all mean the same instance.
 * When the typed host is not the API host (a handle's domain with split
 * domains) and its login fails, src/commands/connectLogin.ts looks the API
 * host up in the host's NodeInfo and retries there once (WFE-343).
 * On a `list` build Tab completes the argument to the listed hosts
 * (src/commands/connectWords.ts, WFE-307).
 * The argument is the only subject; on an unusable one nothing is registered
 * and nothing is saved. Otherwise the session's cached profile of the instance
 * is dropped, so the next detection reads it afresh (decision 5), the
 * instance's app is registered or read from
 * cache, the pending login is stored, and the browser is sent to the instance's
 * authorize page, where the callback handler picks the flow up again.
 */

import { resolveInstanceOrigin } from '../../accounts/origin';
import { t } from '../../i18n/translate';
import { startLogin } from '../connectLogin';
import { OK, fail } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/**
 * Resolve the instance {@link args} names for this build, begin its login and
 * send the browser there, or report why that was not possible.
 */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const instance = resolveInstanceOrigin(
    context.config.instances,
    context.page.origin,
    args.trim(),
  );
  if (!instance.ok) {
    return fail(instance.error);
  }

  const started = await startLogin(context, instance.value);
  if (!started.ok) {
    return fail(started.error);
  }

  context.print(t('commands.defs.connect.opening', { origin: started.value.origin }));
  context.navigate(started.value.url);
  return OK;
}

/** The `/connect` (aliases `/server`, `/login`) definition. */
export const command: CommandDefinition = {
  name: 'connect',
  aliases: ['server', 'login'],
  get usage(): string {
    return t('commands.defs.connect.usage');
  },
  get summary(): string {
    return t('commands.defs.connect.summary');
  },
  run: handle,
};
