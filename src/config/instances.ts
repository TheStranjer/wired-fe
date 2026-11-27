/**
 * The pieces of the build-time configuration that name instances (decision 3):
 * the origin schema, shared by `instances.origins` and the keys of `publicView`,
 * and the {@link InstancesConfig} type.
 */

import * as v from 'valibot';

import { isAllowedInstanceUrl } from '../lib/origin';

/** True when {@link value} is an `https:` origin, or `http:` on a local hostname. */
export function isDevAllowedOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === value && isAllowedInstanceUrl(url);
  } catch {
    return false;
  }
}

/** The message of an origin that fails {@link OriginSchema}. */
export const ORIGIN_MESSAGE = 'must be an https:// origin, or http:// for localhost';

/** A scheme-and-host origin: `https://host[:port]`, or `http:` for localhost. */
export const OriginSchema = v.pipe(v.string(), v.check(isDevAllowedOrigin, ORIGIN_MESSAGE));

/** Which instances the build may talk to (decision 3). */
export type InstancesConfig =
  | { readonly mode: 'same-origin' }
  | { readonly mode: 'fixed'; readonly origin: string }
  | {
      readonly mode: 'list';
      readonly origins: readonly string[];
      /** Also accept any valid typed instance; `false` when absent. An empty list needs this. */
      readonly allowCustom?: boolean | undefined;
    }
  | { readonly mode: 'open' };
