/**
 * The instance-detection step of startup (decision 5): every origin an account
 * lives on is asked what it turned out to be, concurrently and once, and each
 * answer is reported in the status window in order — the profile dispatched and
 * a line printed, or the reason it could not be read. An origin already
 * detected this session is answered from the session cache without asking the
 * instance again.
 */

import type { AppStores } from './stores';
import {
  type ApiError,
  type Detect,
  type InstanceProfile,
  detectInstance,
  describeApiError,
} from '../capabilities/detect';
import { cachedDetect } from '../capabilities/profileCache';
import { t } from '../i18n/translate';
import type { Result } from '../lib/result';
import type { LineLevel } from '../state/buffer';
import type { Dispatch } from '../state/StateContext';
import { STATUS_WINDOW_ID } from '../windows/model';

/** What the detection step needs of startup's dependencies. */
export type DetectDeps = {
  readonly dispatch: Dispatch;
  readonly stores: AppStores;
  readonly now: () => Date;
  /** How to read an instance, when the session cache has none; {@link detectInstance} when absent. */
  readonly detect?: Detect;
};

/** One client message printed into the status window. */
function print(deps: DetectDeps, text: string, level: LineLevel): void {
  deps.dispatch({ type: 'print', windowId: STATUS_WINDOW_ID, date: deps.now(), level, text });
}

/** The line naming what the instance at {@link profile}'s origin turned out to be. */
function connectedLine(profile: InstanceProfile): string {
  return t('app.connected_to', {
    title: profile.title,
    backend: profile.capabilities.backend,
    origin: profile.origin,
  });
}

/** Reports one detection: dispatches the profile and prints, or prints why not. */
function reportDetection(
  deps: DetectDeps,
  origin: string,
  outcome: Result<InstanceProfile, ApiError>,
): void {
  if (outcome.ok) {
    deps.dispatch({ type: 'profile', profile: outcome.value });
    print(deps, connectedLine(outcome.value), 'info');
    return;
  }
  const reason = describeApiError(outcome.error);
  print(deps, t('app.could_not_reach', { origin, reason }), 'error');
}

/** Detects every origin concurrently (decision 5) and reports them in order. */
export async function detectOrigins(deps: DetectDeps, origins: readonly string[]): Promise<void> {
  const detect = cachedDetect(deps.stores.profiles, deps.detect ?? detectInstance, () =>
    deps.now().getTime(),
  );
  const outcomes = await Promise.all(
    origins.map(async (origin) => ({ origin, outcome: await detect(origin) })),
  );
  for (const { origin, outcome } of outcomes) {
    reportDetection(deps, origin, outcome);
  }
}
