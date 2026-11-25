/**
 * Keeps the synced snapshot well under the server's cap (decision 17): the
 * server refuses a settings store over 1 MiB of JSON, whole, so a device
 * class may use only {@link SYNC_BUDGET_BYTES} of it. {@link fitSnapshot}
 * measures a snapshot in UTF-8 bytes and, when it is over, drops from the
 * synced copy alone (the local desk keeps everything) first the windows no
 * pane or float shows, then the empty desktops, then the key overrides past
 * {@link MAX_SYNCED_OVERRIDES}; when that is not enough it refuses. Pure.
 */
import type { SyncSnapshot } from './deskSync';
import { shownPanes } from '../windows/desktopPanes';

/** What one device class may take of the server's 1 MiB store, leaving room for the other class and other apps. */
export const SYNC_BUDGET_BYTES = 384 * 1024;

/** The key overrides a synced copy keeps. */
const MAX_SYNCED_OVERRIDES = 200;

/** What {@link fitSnapshot} decided: send {@link snapshot} (naming what was left out), or send nothing. */
export type Fit =
  | { readonly ok: true; readonly snapshot: SyncSnapshot; readonly dropped: readonly string[] }
  | { readonly ok: false; readonly reason: string };

/** A stage: the snapshot with something left out, and a phrase saying what; null when it has nothing to leave out. */
type Stage = (snapshot: SyncSnapshot) => { snapshot: SyncSnapshot; what: string } | null;

/** The size of {@link snapshot} as the server counts it: the UTF-8 bytes of its JSON. */
export function snapshotBytes(snapshot: SyncSnapshot): number {
  return new TextEncoder().encode(JSON.stringify(snapshot)).length;
}

/** "1 thing" or "3 things". */
function counted(n: number, one: string, many: string): string {
  return `${String(n)} ${n === 1 ? one : many}`;
}

/** Leaves out the windows that no pane or float shows. */
const hiddenWindows: Stage = (snapshot) => {
  const shown = new Set(
    snapshot.layout.desktops.flatMap((desktop) => shownPanes(desktop).map((pane) => pane.windowId)),
  );
  const windows = snapshot.windows.filter((win) => shown.has(win.id));
  const gone = snapshot.windows.length - windows.length;
  return gone === 0
    ? null
    : {
        snapshot: { ...snapshot, windows },
        what: counted(gone, 'hidden window', 'hidden windows'),
      };
};

/** Leaves out the desktops that show nothing, except the active one, which stays the active one. */
const emptyDesktops: Stage = (snapshot) => {
  const { desktops, active } = snapshot.layout;
  const keeps = desktops.map((desktop, i) => i === active || shownPanes(desktop).length > 0);
  const gone = keeps.filter((keep) => !keep).length;
  if (gone === 0) {
    return null;
  }
  return {
    snapshot: {
      ...snapshot,
      layout: {
        ...snapshot.layout,
        desktops: desktops.filter((_, i) => keeps[i] === true),
        active: keeps.slice(0, active).filter(Boolean).length,
      },
    },
    what: counted(gone, 'empty desktop', 'empty desktops'),
  };
};

/** Leaves out the key overrides past the first {@link MAX_SYNCED_OVERRIDES}. */
const extraOverrides: Stage = (snapshot) => {
  const gone = snapshot.settings.keyOverrides.length - MAX_SYNCED_OVERRIDES;
  if (gone <= 0) {
    return null;
  }
  const keyOverrides = snapshot.settings.keyOverrides.slice(0, MAX_SYNCED_OVERRIDES);
  return {
    snapshot: { ...snapshot, settings: { ...snapshot.settings, keyOverrides } },
    what: counted(gone, 'key override', 'key overrides'),
  };
};

/** The stages, in the order they are tried. */
const STAGES: readonly Stage[] = [hiddenWindows, emptyDesktops, extraOverrides];

/** The reason sync pauses when even the trimmed desk is over {@link budget} bytes. */
function pausedReason(budget: number): string {
  return `Sync paused: the desk is too big to sync (over ${String(Math.round(budget / 1024))} KiB even without hidden windows, empty desktops and extra key overrides); it is kept here`;
}

/**
 * The snapshot to send for {@link budgetBytes}: {@link snapshot} itself when it
 * fits, else with the stages' leavings dropped one stage at a time until it
 * does; a refusal when it never does.
 */
export function fitSnapshot(snapshot: SyncSnapshot, budgetBytes: number): Fit {
  const dropped: string[] = [];
  let current = snapshot;
  for (const stage of STAGES) {
    if (snapshotBytes(current) <= budgetBytes) {
      break;
    }
    const next = stage(current);
    if (next !== null) {
      current = next.snapshot;
      dropped.push(next.what);
    }
  }
  return snapshotBytes(current) <= budgetBytes
    ? { ok: true, snapshot: current, dropped }
    : { ok: false, reason: pausedReason(budgetBytes) };
}
