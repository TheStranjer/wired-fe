/**
 * Writing the desk to a settings store (decision 17), within the store's cap:
 * the snapshot is fitted to the session's byte budget first (./deskFit), so
 * what the server keeps may leave out hidden windows, empty desktops and
 * extra key overrides while the local desk keeps everything, or nothing is
 * sent when even that is too big. A server that still says 422 `tooLarge`
 * (other apps filled the store) gets one retry at half the budget; then the
 * failure is the usual one. Nothing here logs a token or the desk.
 */
import { readStamp, writeStamp } from './deskStamp';
import { fail } from './deskSyncFail';
import { type SyncDeps, report, warnOnce } from './deskSyncKit';
import type { StoredAccount } from '../accounts/accountStore';
import { writeSettings } from '../features/sync/settingsAccess';
import { SYNC_BUDGET_BYTES, fitSnapshot } from '../state/deskFit';
import { syncPatch, toSyncSnapshot } from '../state/deskSync';
import type { SyncSnapshot } from '../state/deskSync';
import { describeTrimmed } from '../state/syncError';

/** The stamp the pushed snapshot carries: the local one, or now when nothing has changed here yet. */
function stampOf(deps: SyncDeps): number {
  const saved = readStamp(deps.source);
  if (saved > 0) {
    return saved;
  }
  const now = deps.now();
  writeStamp(deps.source, now);
  return now;
}

/** Halves the budget the first time it is asked, and says whether it did. */
function halveOnce(deps: SyncDeps): boolean {
  const budget = deps.session.budget.get();
  if (budget < SYNC_BUDGET_BYTES) {
    return false;
  }
  deps.session.budget.set(budget / 2);
  return true;
}

/** Sends {@link snapshot} fitted to the budget; answers whether the server took it. */
async function attempt(
  deps: SyncDeps,
  account: StoredAccount,
  snapshot: SyncSnapshot,
): Promise<boolean> {
  const fit = fitSnapshot(snapshot, deps.session.budget.get());
  if (!fit.ok) {
    warnOnce(deps, 'paused', fit.reason);
    report(deps, { failed: true, lastError: fit.reason });
    return false;
  }
  if (fit.dropped.length > 0) {
    warnOnce(deps, `trimmed ${fit.dropped.join()}`, describeTrimmed(fit.dropped));
  }
  const sent = await writeSettings(account, syncPatch(deps.source.deviceClass, fit.snapshot));
  if (sent.ok) {
    report(deps, { failed: false, lastPush: deps.now() });
    return true;
  }
  if (sent.error.kind === 'tooLarge' && halveOnce(deps)) {
    return await attempt(deps, account, snapshot);
  }
  fail(deps, account, sent.error);
  return false;
}

/** Writes the desk to {@link account}'s settings store; answers whether the server took it. */
export async function send(deps: SyncDeps, account: StoredAccount): Promise<boolean> {
  return await attempt(deps, account, toSyncSnapshot(deps.getState(), stampOf(deps)));
}
