/**
 * `/connect` (decision 6, decision 8): start an OAuth login. Which instance is
 * the build's to say (decision 3): a `same-origin` or `fixed` build logs into
 * its own backend and ignores the argument, a `list` build takes one of its
 * options (or, with `allowCustom`, anything typed) and an `open` build, the
 * same as an empty `allowCustom` list, whatever the user typed — `wired.example`,
 * `https://wired.example` or `@lain@wired.example` all mean the same instance.
 * The argument is the only subject; on an unusable one nothing is registered
 * and nothing is saved. Otherwise the session's cached profile of the instance
 * is dropped, so the next detection reads it afresh (decision 5), the
 * instance's app is registered or read from
 * cache, the pending login is stored, and the browser is sent to the instance's
 * authorize page, where the callback handler picks the flow up again.
 */

import { beginLogin } from '../../accounts/beginLogin';
import { redirectUriFor } from '../../accounts/callback';
import { resolveInstanceOrigin } from '../../accounts/origin';
import { describeApiError } from '../../api/errors';
import { forgetProfile } from '../../capabilities/profileCache';
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

  forgetProfile(context.stores.profiles, instance.value);
  const started = await beginLogin(
    { apps: context.stores.apps, login: context.stores.login },
    {
      origin: instance.value,
      redirectUri: redirectUriFor(context.page),
      appName: context.config.appName,
      now: context.now().getTime(),
    },
  );
  if (!started.ok) {
    return fail(`Could not start login: ${describeApiError(started.error)}`);
  }

  context.print(`Opening ${instance.value} to log in…`);
  context.navigate(started.value);
  return OK;
}

/** The `/connect` (aliases `/server`, `/login`) definition. */
export const command: CommandDefinition = {
  name: 'connect',
  aliases: ['server', 'login'],
  usage: '/connect [instance]',
  summary: 'Log in to an instance',
  run: handle,
};
