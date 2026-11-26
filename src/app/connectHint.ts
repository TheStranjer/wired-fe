/**
 * The `/connect` hint a build with no signed-in accounts opens with
 * (decision 3), worded by instance mode: same-origin and fixed builds know
 * where their backend is and just say `to log in`; a list build names the
 * origins to choose between (and says so when any other works too); an open
 * build gives an example. Pure copy;
 * src/app/startup.ts prints the line it returns into the status window.
 */

import type { InstancesConfig } from '../config/schema';

/** The hint for a build where the user types any instance. */
const OPEN_HINT = 'Not connected. Type /connect <instance>, e.g. /connect wired.example';

/** The hint for a `list` build: the options, plus a note when others work too. */
function listHint(origins: readonly string[], allowCustom: boolean): string {
  if (origins.length === 0) {
    return OPEN_HINT;
  }
  const available = `Not connected. Type /connect <instance>. Available: ${origins.join(', ')}`;
  return allowCustom ? `${available}. Any other instance works too.` : available;
}

/** What a build with no accounts says about `/connect`, by instance mode. */
export function connectHint(instances: InstancesConfig): string {
  switch (instances.mode) {
    case 'same-origin':
    case 'fixed':
      return 'Not connected. Type /connect to log in.';
    case 'list':
      return listHint(instances.origins, instances.allowCustom === true);
    case 'open':
      return OPEN_HINT;
  }
}
