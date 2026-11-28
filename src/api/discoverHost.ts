/**
 * API host discovery (WFE-343): with split domains a handle's domain
 * (`hyper.test`) only redirects `/.well-known/nodeinfo` to the server that
 * really serves the API (`fedi.hyper.test`). This asks the typed origin for
 * that link list with a plain, credential-less `fetch` and a short timeout and
 * names the origin of the first link, so `/connect` can try login there.
 * It never throws: any failure (network, CORS, bad JSON, no usable link) is
 * `null`.
 */
import * as v from 'valibot';

import { NodeInfoLinksSchema } from './schemas/nodeinfo';
import { isAllowedInstanceUrl } from '../lib/origin';

/** How long the discovery request may take before it counts as failed. */
const DISCOVERY_TIMEOUT_MS = 5000;

/** The origin of the first link's href when it is a usable instance URL; null otherwise. */
function firstLinkOrigin(body: unknown): string | null {
  const parsed = v.safeParse(NodeInfoLinksSchema, body);
  const href = parsed.success ? parsed.output.links[0]?.href : undefined;
  if (href === undefined) {
    return null;
  }
  try {
    const url = new URL(href);
    return isAllowedInstanceUrl(url) ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * The origin the instance at {@link origin} says serves its API, read from
 * its `/.well-known/nodeinfo`; null when it cannot be discovered or is
 * {@link origin} itself.
 */
export async function discoverApiOrigin(origin: string): Promise<string | null> {
  try {
    const response = await fetch(new URL('/.well-known/nodeinfo', origin), {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    });
    const found = firstLinkOrigin(await response.json());
    return found === origin ? null : found;
  } catch {
    return null;
  }
}
