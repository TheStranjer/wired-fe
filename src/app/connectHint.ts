/**
 * The `/connect` hint a build with no signed-in accounts opens with
 * (decision 3), worded by instance mode: same-origin and fixed builds know
 * where their backend is and just say `to log in`; a list build names the
 * origins to choose between; an open build gives an example. Pure copy;
 * src/app/startup.ts prints the line it returns into the status window.
 */

import type { InstancesConfig } from '../config/schema';

/** What a build with no accounts says about `/connect`, by instance mode. */
export function connectHint(instances: InstancesConfig): string {
  switch (instances.mode) {
    case 'same-origin':
    case 'fixed':
      return 'Not connected. Type /connect to log in.';
    case 'list':
      return `Not connected. Type /connect <instance>. Available: ${instances.origins.join(', ')}`;
    case 'open':
      return 'Not connected. Type /connect <instance>, e.g. /connect wired.example';
  }
}
