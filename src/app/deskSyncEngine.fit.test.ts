/**
 * Tests for the size guard in the desk sync engine (decision 17): a desk over
 * the byte budget is pushed without what the server copy can do without and
 * the reader is told once, a desk that cannot be trimmed enough is not pushed
 * at all, and a 422 `tooLarge` from a server whose store other apps filled
 * halves the budget once and retries, then gives up with the usual warning.
 * The calls themselves are mocked; they have their own tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeStamp } from './deskStamp';
import { PUSH_DELAY_MS, createEngine } from './deskSyncEngine';
import { readSettings, writeSettings } from '../features/sync/settingsAccess';
import { err, ok } from '../lib/result';
import { type SyncHarness, printed, served, syncHarness } from '../test/syncHarness';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

vi.mock(import('../features/sync/settingsAccess'), () => ({
  readSettings: vi.fn(),
  writeSettings: vi.fn(),
}));

const read = vi.mocked(readSettings);
const write = vi.mocked(writeSettings);

/** A window of Lain's no pane shows yet. */
const NOTES: WindowRef = { kind: 'search', accountKey: null, target: 'notes' };

/** A world whose server holds exactly its desk, with the engine started. */
async function inSync() {
  const harness = syncHarness();
  writeStamp(harness.io.source, 3000);
  read.mockResolvedValue(ok({ desktop: served(harness.state(), 3000) }));
  const engine = createEngine(harness.io);
  engine.start();
  await vi.advanceTimersByTimeAsync(0);
  return { harness, engine };
}

/** Another window, opened after the big one to take its place in the focused pane. */
const OTHER: WindowRef = { kind: 'search', accountKey: null, target: 'other' };

/** Opens {@link ref} titled {@link title}; it takes the focused pane. */
function open(harness: SyncHarness, ref: WindowRef, title: string): void {
  harness.change({ type: 'windows', action: { type: 'open', ref, title } });
}

/** Opens a window whose title is {@link kib} KiB long: in the focused pane when {@link shown}, else pushed out of it to a hidden buffer. */
function openBig(harness: SyncHarness, kib: number, shown: boolean): void {
  open(harness, NOTES, 'n'.repeat(kib * 1024));
  if (!shown) {
    open(harness, OTHER, 'other');
  }
}

/** Tells the engine the desk changed at {@link time}, and lets the push run. */
async function pushAt(world: Awaited<ReturnType<typeof inSync>>, time: number): Promise<void> {
  world.harness.setTime(time);
  world.engine.changed();
  await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS);
}

/** The reader switches to desktop {@link n}: a change the synced desk shows. */
function moveTo(world: Awaited<ReturnType<typeof inSync>>, n: number): void {
  world.harness.change({ type: 'layout', action: { type: 'goToDesktop', n } });
}

/** The JSON text of the body the {@link n}th write sent. */
function bodyOf(n: number): string {
  return JSON.stringify(write.mock.calls[n]?.[1]);
}

describe('desk sync size guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    read.mockReset();
    write.mockReset();
    write.mockResolvedValue(ok({}));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pushes a desk under the budget whole and says nothing', async () => {
    const world = await inSync();
    openBig(world.harness, 100, false);

    await pushAt(world, 10_000);

    expect(bodyOf(0)).toContain('nnnn');
    expect(printed(world.harness)).toStrictEqual([]);
  });

  it('pushes without the hidden windows when the desk is over the budget, and says so once', async () => {
    const world = await inSync();
    openBig(world.harness, 400, false);

    await pushAt(world, 10_000);
    moveTo(world, 2);
    await pushAt(world, 20_000);

    expect(write).toHaveBeenCalledTimes(2);
    expect(bodyOf(0)).not.toContain('nnnn');
    expect(world.harness.state().windows.windows.map((win) => win.id)).toContain(windowId(NOTES));
    expect(printed(world.harness)).toStrictEqual([
      'Sync: the desk is large, so the copy on the server leaves out 2 hidden windows; this device keeps them',
    ]);
    expect(world.harness.state().sync).toMatchObject({ failed: false, lastPush: 20_000 });
  });

  it('does not push, and says sync is paused, when the shown desk is too big', async () => {
    const world = await inSync();
    openBig(world.harness, 400, true);

    await pushAt(world, 10_000);
    moveTo(world, 2);
    await pushAt(world, 20_000);

    expect(write).not.toHaveBeenCalled();
    expect(printed(world.harness)).toHaveLength(1);
    expect(printed(world.harness)[0]).toContain('Sync paused: the desk is too big to sync');
    expect(world.harness.state().sync).toMatchObject({ failed: true, pending: false });
  });

  it('halves the budget once and retries when the server says it is too large', async () => {
    const world = await inSync();
    write.mockResolvedValueOnce(err({ kind: 'tooLarge' }));
    openBig(world.harness, 250, false);

    await pushAt(world, 10_000);

    expect(write).toHaveBeenCalledTimes(2);
    expect(bodyOf(0)).toContain('nnnn');
    expect(bodyOf(1)).not.toContain('nnnn');
    expect(printed(world.harness)).toStrictEqual([
      'Sync: the desk is large, so the copy on the server leaves out 2 hidden windows; this device keeps them',
    ]);
    expect(world.harness.state().sync).toMatchObject({ failed: false, lastPush: 10_000 });
  });

  it('gives up with a warning when the halved budget is refused too, and does not halve again', async () => {
    const world = await inSync();
    write.mockResolvedValue(err({ kind: 'tooLarge' }));
    openBig(world.harness, 250, false);

    await pushAt(world, 10_000);

    expect(write).toHaveBeenCalledTimes(2);
    expect(printed(world.harness)).toContain(
      'Sync: the server says the desk is too large to store',
    );
    expect(world.harness.state().sync).toMatchObject({ failed: true });

    moveTo(world, 2);
    await pushAt(world, 30_000);

    expect(write).toHaveBeenCalledTimes(3);
  });
});
