/**
 * What a hash route says when no account can open it (decision 4): an
 * unqualified route has no active account, so it is the `/connect` hint; a
 * qualified one names the instance nobody is signed in to. Pure copy;
 * src/app/useHashRoute.ts prints the line into the status window.
 */

import { connectHint } from './connectHint';
import { buildConfig } from '../config/config';
import { t } from '../i18n/translate';
import { hostOfOrigin } from '../lib/origin';
import { type Route, routeOrigin } from '../lib/route';

/** The line to print for {@link route}, which no signed-in account can open. */
export function routeHint(route: Route): string {
  const origin = routeOrigin(route);
  return origin === undefined
    ? connectHint(buildConfig.instances)
    : t('features.route.no_account', { host: hostOfOrigin(origin) });
}
