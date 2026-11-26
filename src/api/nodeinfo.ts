/**
 * NodeInfo discovery (decision 5): ask `/.well-known/nodeinfo` on the instance
 * origin for its link list, follow the NodeInfo 2.1 link — or the 2.0 one when
 * the list has no 2.1 — to the document, and hand back the normalized result.
 * An href that is not an absolute URL on the same origin is refused: a server
 * must not be able to point WiredFE at somebody else's description of it.
 * Failures of either request propagate unchanged; a missing or untrusted link
 * is a `parse` error.
 */
import type { ApiError } from './errors';
import { requestData } from './http';
import {
  type NodeInfo,
  type NodeInfoLinks,
  NodeInfoLinksSchema,
  NodeInfoSchema,
} from './schemas/nodeinfo';
import { t } from '../i18n/translate';
import { type Result, err, ok } from '../lib/result';

/** The NodeInfo 2.1 link relation, the version WiredFE prefers. */
export const NODEINFO_REL_21 = 'http://nodeinfo.diaspora.software/ns/schema/2.1';

/** The NodeInfo 2.0 link relation, used when the list offers no 2.1 link. */
export const NODEINFO_REL_20 = 'http://nodeinfo.diaspora.software/ns/schema/2.0';

/** The discovery path queried on the instance origin. */
const WELL_KNOWN_PATH = '/.well-known/nodeinfo';

/** The relations WiredFE understands, best first. */
const PREFERRED_RELS: readonly string[] = [NODEINFO_REL_21, NODEINFO_REL_20];

/** The href of the first preferred link present in {@link links}; null when none is. */
function preferredHref(links: NodeInfoLinks['links']): string | null {
  for (const rel of PREFERRED_RELS) {
    const link = links.find((candidate) => candidate.rel === rel);
    if (link !== undefined) {
      return link.href;
    }
  }
  return null;
}

/** The URL of {@link href} when it is an absolute URL served from {@link origin}; null otherwise. */
function sameOriginUrl(href: string, origin: string): URL | null {
  try {
    const url = new URL(href);
    return url.origin === origin ? url : null;
  } catch {
    return null;
  }
}

/**
 * Fetches the NodeInfo document of the instance at {@link origin} through its
 * `/.well-known/nodeinfo` discovery, cancellable with {@link signal}.
 */
export async function fetchNodeInfo(
  origin: string,
  signal?: AbortSignal,
): Promise<Result<NodeInfo, ApiError>> {
  const links = await requestData({
    origin,
    path: WELL_KNOWN_PATH,
    schema: NodeInfoLinksSchema,
    signal,
  });
  if (!links.ok) {
    return links;
  }
  const href = preferredHref(links.value.links);
  if (href === null) {
    return err({ kind: 'parse', message: t('api.nodeinfo_no_link') });
  }
  const url = sameOriginUrl(href, origin);
  if (url === null) {
    return err({ kind: 'parse', message: t('api.nodeinfo_other_origin') });
  }
  const doc = await requestData({
    origin,
    path: `${url.pathname}${url.search}`,
    schema: NodeInfoSchema,
    signal,
  });
  return doc.ok ? ok(doc.value) : doc;
}
