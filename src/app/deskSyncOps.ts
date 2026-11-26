/**
 * The steps of the desk sync (decision 17), as plain async functions over
 * injected {@link SyncDeps}: a pull reads the primary account's settings
 * store and, by the newest-wins rule of `decideSync`, applies it, keeps the
 * local desk or asks for a push; a push writes `{ [deviceClass]: snapshot }`
 * and says nothing when it works. A failure keeps the session working
 * locally: it is warned once per kind, shown in the status line and `/sync`,
 * and the next local change tries again. A 404/501 drops the capability and
 * the sync goes quiet. Nothing here logs a token or the contents of a desk.
 */
import { readStamp, writeStamp } from './deskStamp';
import { fail } from './deskSyncFail';
import { type SyncDeps, report, say, target, warnOnce } from './deskSyncKit';
import { send } from './deskSyncSend';
import { readSettings } from '../features/sync/settingsAccess';
import { t } from '../i18n/translate';
import {
  type SyncDecision,
  type SyncSnapshot,
  decideSync,
  deskBody,
  fromSyncSnapshot,
} from '../state/deskSync';
import { invalidRemoteText } from '../state/syncError';

/** Puts the server's {@link snapshot} in place of the desk and the settings, and remembers what was put. */
function apply(deps: SyncDeps, snapshot: SyncSnapshot): void {
  const next = fromSyncSnapshot(snapshot, deps.getState().accounts);
  deps.session.baseline.set(deskBody(next));
  writeStamp(deps.source, snapshot.updatedAt);
  deps.dispatch({ type: 'restore', windows: next.windows, layout: next.layout });
  deps.dispatch({ type: 'settings', settings: next.settings });
}

/** Acts on {@link decision}: apply the server's desk, ask for a push, or say it was unreadable. */
function settle(deps: SyncDeps, decision: SyncDecision): void {
  if (decision.kind === 'apply') {
    apply(deps, decision.snapshot);
  } else if (decision.kind === 'push') {
    deps.arm();
  } else if (decision.kind === 'invalid') {
    warnOnce(deps, 'invalid', invalidRemoteText());
  }
}

/**
 * Reads the primary's settings store and settles it against the local desk.
 * Answers what was decided, or null when there is no primary or the read failed.
 */
export async function pullOnce(deps: SyncDeps): Promise<SyncDecision['kind'] | null> {
  const account = target(deps);
  if (account === null) {
    return null;
  }
  const got = await readSettings(account);
  if (!got.ok) {
    fail(deps, account, got.error);
    return null;
  }
  deps.session.pulledKey.set(account.key);
  report(deps, { failed: false, lastPull: deps.now() });
  const decision = decideSync(readStamp(deps.source), got.value[deps.source.deviceClass]);
  settle(deps, decision);
  return decision.kind;
}

/**
 * Writes the desk and settings to the primary's settings store. A primary not
 * pulled from yet is pulled from first, so a push never covers a newer server
 * copy. Answers whether the server took the desk.
 */
export async function pushOnce(deps: SyncDeps): Promise<boolean> {
  const account = target(deps);
  if (account === null) {
    report(deps, {});
    return false;
  }
  if (deps.session.pulledKey.get() !== account.key) {
    await pullOnce(deps);
    report(deps, {});
    return false;
  }
  return await send(deps, account);
}

/** `/sync now`: pull, then push whatever the pull left to push, and say how it went. */
export async function syncNow(deps: SyncDeps): Promise<void> {
  const kind = await pullOnce(deps);
  if (kind === null) {
    return;
  }
  if (kind === 'apply') {
    say(deps, 'info', t('app.sync_took_newer'));
    return;
  }
  deps.cancel();
  if (await pushOnce(deps)) {
    say(deps, 'info', t('app.sync_up_to_date'));
  }
}
