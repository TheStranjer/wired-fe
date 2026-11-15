/**
 * Instance detection (decision 5): the one connect-time read of what an
 * instance says about itself — NodeInfo, `/api/v1/instance` and
 * `/api/v2/instance`, asked at once and without a token — compiled into an
 * {@link InstanceProfile}. Everything above this layer works with the profile's
 * {@link Capabilities} and never with the backend's name. Without NodeInfo
 * nothing can be derived, so its failure is the failure of the whole detection;
 * an instance document that does not answer is simply absent, and the limits it
 * would have carried stay at their defaults.
 */
import { type Capabilities, deriveCapabilities } from './capabilities';
import { getInstanceV1, getInstanceV2 } from '../api/endpoints/instance';
import type { ApiError } from '../api/errors';
import { fetchNodeInfo } from '../api/nodeinfo';
import type { InstanceV1 } from '../api/schemas/instanceV1';
import type { InstanceV2 } from '../api/schemas/instanceV2';
import type { NodeInfo } from '../api/schemas/nodeinfo';
import type { ApiSession } from '../api/session';
import { type Result, ok } from '../lib/result';

/** What one instance turned out to be: how to name it and what it can do. */
export type InstanceProfile = {
  /** The origin the profile was read from, e.g. `https://wired.example`. */
  readonly origin: string;
  /** The instance's own title, or its hostname when none of the documents has one. */
  readonly title: string;
  /** The capabilities derived from the three documents (decision 5). */
  readonly capabilities: Capabilities;
};

/** The documents of a connect, with the ones that did not answer as null. */
type Documents = {
  readonly nodeInfo: NodeInfo;
  readonly v1: InstanceV1 | null;
  readonly v2: InstanceV2 | null;
};

/** The data of {@link result}; null when the request failed, i.e. no document. */
function dataOrNull<T>(result: Result<T, ApiError>): T | null {
  return result.ok ? result.value : null;
}

/** The name to show for {@link docs} on {@link origin}: newest title first. */
function titleOf(docs: Documents, origin: string): string {
  return docs.v2?.title ?? docs.v1?.title ?? docs.nodeInfo.nodeName ?? new URL(origin).hostname;
}

/**
 * Reads the instance at {@link origin} and returns its {@link InstanceProfile}
 * (decision 5). The three documents are requested concurrently and
 * anonymously; {@link signal} cancels all of them. A NodeInfo that cannot be
 * read fails the detection and is returned as its own {@link ApiError}.
 */
export async function detectInstance(
  origin: string,
  signal?: AbortSignal,
): Promise<Result<InstanceProfile, ApiError>> {
  const session: ApiSession = { origin, token: null };
  const [nodeInfo, v1, v2] = await Promise.all([
    fetchNodeInfo(origin, signal),
    getInstanceV1(session, signal),
    getInstanceV2(session, signal),
  ]);
  if (!nodeInfo.ok) {
    return nodeInfo;
  }
  const docs: Documents = { nodeInfo: nodeInfo.value, v1: dataOrNull(v1), v2: dataOrNull(v2) };
  return ok({ origin, title: titleOf(docs, origin), capabilities: deriveCapabilities(docs) });
}

/**
 * How to say a detection failed, in one line: the `src/api` error type and its
 * description, re-exported so callers above the api layer (decision 10) can
 * handle and report a failed {@link detectInstance} without importing from
 * `src/api` themselves.
 */
export { describeApiError } from '../api/errors';
export type { ApiError } from '../api/errors';
