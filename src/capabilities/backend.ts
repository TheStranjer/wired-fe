/**
 * The backend family of an instance (decision 5): the one place the brand name
 * from NodeInfo's `software.name` is read. Everything above this layer works
 * with the family and, in later tickets, the capability flags derived from it.
 * Names reach us already lowercased by the NodeInfo schema in `src/api`, so
 * the mapping is exact: known names to families, forks of Mastodon to
 * `mastodon`, everything else to `unknown`. Version strings are never sniffed.
 */
import type { NodeInfo } from '../api/schemas/nodeinfo';

/** Every server software family WiredFE distinguishes, for code that has to check a stored one. */
export const BACKENDS = ['wired', 'pleroma', 'akkoma', 'mastodon', 'unknown'] as const;

/** The server software families WiredFE distinguishes. */
export type Backend = (typeof BACKENDS)[number];

/** The backend family named by {@link NodeInfo.software.name}. */
export function identifyBackend(nodeInfo: Pick<NodeInfo, 'software'>): Backend {
  switch (nodeInfo.software.name) {
    case 'wired':
      return 'wired';
    case 'pleroma':
      return 'pleroma';
    case 'akkoma':
      return 'akkoma';
    case 'mastodon':
    case 'hometown':
    case 'glitch':
    case 'glitchsoc':
      return 'mastodon';
    default:
      return 'unknown';
  }
}

/** True for backends that speak the Pleroma API dialect (Wired, Pleroma, Akkoma). */
export function speaksPleromaDialect(backend: Backend): boolean {
  switch (backend) {
    case 'wired':
    case 'pleroma':
    case 'akkoma':
      return true;
    case 'mastodon':
    case 'unknown':
      return false;
  }
}
