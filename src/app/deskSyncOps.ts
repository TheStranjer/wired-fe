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
import { type SyncDeps, report, say, target, warnOnce } from './deskSyncKit';
import type { StoredAccount } from '../accounts/accountStore';
import { forgetIfUnsupported } from '../capabilities/forgetIfUnsupported';
import { readSettings, writeSettings } from '../features/sync/settingsAccess';
import type { SettingsStoreError } from '../features/sync/settingsAccess';
import {
  type SyncDecision,
  type SyncSnapshot,
  decideSync,
  deskBody,
  fromSyncSnapshot,
  syncPatch,
  toSyncSnapshot,
} from '../state/deskSync';
import { INVALID_REMOTE_TEXT, describeSyncError } from '../state/syncError';

/** Handles a refusal of {@link account}'s server: quiet for a missing store, a warning once per kind otherwise. */
function fail(deps: SyncDeps, account: StoredAccount, error: SettingsStoreError): void {
  const text = describeSyncError(error);
  if (error.kind === 'unsupported') {
    forgetIfUnsupported(deps.profiles, account.origin, error);
    deps.dispatch({ type: 'syncUnsupported', origin: account.origin });
    report(deps, { failed: false, lastError: text });
    return;
  }
  warnOnce(deps, error.kind, text);
  report(deps, { failed: true, lastError: text });
}

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
    warnOnce(deps, 'invalid', INVALID_REMOTE_TEXT);
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

/** Writes the desk to {@link account}'s settings store; answers whether the server took it. */
async function send(deps: SyncDeps, account: StoredAccount): Promise<boolean> {
  const snapshot = toSyncSnapshot(deps.getState(), stampOf(deps));
  const sent = await writeSettings(account, syncPatch(deps.source.deviceClass, snapshot));
  if (!sent.ok) {
    fail(deps, account, sent.error);
    return false;
  }
  report(deps, { failed: false, lastPush: deps.now() });
  return true;
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
    say(deps, 'info', 'Sync: took the newer desk from the server');
    return;
  }
  deps.cancel();
  if (await pushOnce(deps)) {
    say(deps, 'info', 'Sync: up to date');
  }
}
