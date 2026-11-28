/**
 * The login attempt behind `/connect` (WFE-343). It tries the instance as
 * typed; when the user's input picked that instance and the attempt failed
 * with a network error or an HTTP 404/405 — a handle's domain that is not the
 * API host — it asks the typed host's NodeInfo where the API lives and tries
 * once more there, which is final. Without a better origin the error comes
 * back with a hint. Success of the first attempt changes nothing.
 */

import type { CommandContext } from './types';
import { beginLogin } from '../accounts/beginLogin';
import { redirectUriFor } from '../accounts/callback';
import { isTypedInstance } from '../accounts/origin';
import { discoverApiOrigin } from '../api/discoverHost';
import { type ApiError, describeApiError } from '../api/errors';
import { forgetProfile } from '../capabilities/profileCache';
import { t } from '../i18n/translate';
import { type Result, err, ok } from '../lib/result';

/** Where a login went: the instance that was used and its authorize URL. */
export type StartedLogin = { readonly origin: string; readonly url: string };

/** Whether {@link error} could mean the typed host is not the API host. */
function mayBeWrongHost(error: ApiError): boolean {
  return error.kind === 'network' || (error.kind === 'http' && [404, 405].includes(error.status));
}

/** Begins a login on {@link origin}, dropping the session's cached profile of it first. */
async function attempt(
  context: CommandContext,
  origin: string,
): Promise<Result<StartedLogin, ApiError>> {
  forgetProfile(context.stores.profiles, origin);
  const started = await beginLogin(
    { apps: context.stores.apps, login: context.stores.login },
    {
      origin,
      redirectUri: redirectUriFor(context.page),
      appName: context.config.appName,
      now: context.now().getTime(),
    },
  );
  return started.ok ? ok({ origin, url: started.value }) : started;
}

/** The text shown for a login that could not start: {@link reason}, plus the hint when asked. */
function couldNotStart(error: ApiError, withHint: boolean): string {
  const line = t('commands.defs.connect.could_not_start', { reason: describeApiError(error) });
  return withHint ? `${line}\n${t('commands.defs.connect.host_hint')}` : line;
}

/**
 * Starts a login on {@link origin}, falling back to the API host its
 * NodeInfo names when the input picked it and it does not answer as one.
 * The failure is the message to show the user.
 */
export async function startLogin(
  context: CommandContext,
  origin: string,
): Promise<Result<StartedLogin, string>> {
  const first = await attempt(context, origin);
  if (first.ok) {
    return first;
  }
  const discoverable = isTypedInstance(context.config.instances, origin);
  if (!discoverable || !mayBeWrongHost(first.error)) {
    return err(couldNotStart(first.error, false));
  }
  const found = await discoverApiOrigin(origin);
  if (found === null) {
    return err(couldNotStart(first.error, true));
  }
  context.print(t('commands.defs.connect.discovered', { host: origin, origin: found }));
  const second = await attempt(context, found);
  return second.ok ? second : err(couldNotStart(second.error, false));
}
