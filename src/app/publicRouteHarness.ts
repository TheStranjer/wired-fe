/**
 * The wiring the signed-out route's tests share (WFE-340): what an instance
 * publishes about anonymous reads, the profile that gives, the dependencies
 * {@link openPublicRoute} is handed, and the readers of what it dispatched. It
 * lives here, not in src/test, because the test-support layer may not reach
 * the capabilities. Test wiring only; no assertion lives here.
 */
import type { PublicDeps } from './publicRoute';
import type { InstanceProfile } from '../capabilities/detect';
import type { AnonymousReads } from '../capabilities/publicView';
import { capabilitiesOn } from '../capabilities/testCapabilities';
import type { Dispatch } from '../state/StateContext';

/** The calls a recording dispatch saw. */
type Calls = { readonly mock: { readonly calls: readonly Parameters<Dispatch>[] } };

/** What an instance publishes: every read set to {@link value}. */
export function publishing(value: boolean | null): AnonymousReads {
  const both = { local: value, remote: value };
  return { posts: both, profiles: both, tags: both };
}

/** The instance at {@link origin} as detected, publishing {@link reads}. */
export function profileOf(origin: string, reads: AnonymousReads): InstanceProfile {
  return {
    origin,
    title: 'Wired',
    capabilities: { ...capabilitiesOn('wired', []), anonymousReads: reads },
  };
}

/** The dependencies of a page at {@link here}, with {@link known} already detected. */
export function depsOf(
  parts: Omit<PublicDeps, 'here' | 'now' | 'profiles'>,
  here: string,
  known?: InstanceProfile,
): PublicDeps {
  return {
    ...parts,
    here,
    profiles: new Map(known === undefined ? [] : [[here, known]]),
    now: () => new Date('2026-11-27T10:00:00.000Z'),
  };
}

/** The window the visitor's route opened, as the dispatch saw it. */
export function openedWindow(dispatch: Calls): unknown {
  return dispatch.mock.calls.map(([action]) => action).find((action) => action.type === 'windows');
}

/** The texts the dispatch was asked to print. */
export function printed(dispatch: Calls): readonly string[] {
  return dispatch.mock.calls.flatMap(([action]) => (action.type === 'print' ? [action.text] : []));
}
