/**
 * Tests for the desk sync's push (decision 17): a change is stamped and
 * pushed 3 s after the last one, as `{ desktop: snapshot }`; a change the
 * saved desk does not show pushes nothing; a stopped engine or a primary that
 * can no longer hold the desk pushes nothing; a primary not pulled from yet is
 * pulled from first. The calls themselves are mocked; they have their own
 * tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeStamp } from './deskStamp';
import { PUSH_DELAY_MS, createEngine } from './deskSyncEngine';
import { readSettings, writeSettings } from '../features/sync/settingsAccess';
import { ok } from '../lib/result';
import { toSyncSnapshot } from '../state/deskSync';
import { THREAD_ID } from '../test/deskFixtures';
import { served, syncHarness } from '../test/syncHarness';
import type { SyncHarness, SyncWorldOptions } from '../test/syncHarness';

vi.mock(import('../features/sync/settingsAccess'), () => ({
  readSettings: vi.fn(),
  writeSettings: vi.fn(),
}));

const read = vi.mocked(readSettings);
const write = vi.mocked(writeSettings);

/** Switches to desktop 2 and back to 1: changes the synced desk shows. */
const TO_DESKTOP_2 = { type: 'layout', action: { type: 'goToDesktop', n: 2 } } as const;
const TO_DESKTOP_1 = { type: 'layout', action: { type: 'goToDesktop', n: 1 } } as const;

/** Marks the hidden thread window unread: a change the synced desk does not show. */
const THREAD_UNREAD = {
  type: 'windows',
  action: { type: 'markUnread', id: THREAD_ID, count: 3, highlight: false },
} as const;

/** A world whose server holds exactly its desk, stamped as the reader's own, with the engine started. */
async function inSync(options: SyncWorldOptions = {}) {
  const harness = syncHarness(options);
  writeStamp(harness.io.source, 3000);
  read.mockResolvedValue(ok({ desktop: served(harness.state(), 3000) }));
  const engine = createEngine(harness.io);
  engine.start();
  await vi.advanceTimersByTimeAsync(0);
  return { harness, engine };
}

/** The reader makes {@link action} at {@link time}, and the engine is told. */
function edit(
  { harness, engine }: Awaited<ReturnType<typeof inSync>>,
  action: Parameters<SyncHarness['change']>[0],
  time: number,
): void {
  harness.setTime(time);
  harness.change(action);
  engine.changed();
}

describe('desk sync push', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    read.mockReset();
    write.mockReset();
    write.mockResolvedValue(ok({}));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pushes a burst of changes once, 3 s after the last, as the device class key', async () => {
    const world = await inSync();

    edit(world, TO_DESKTOP_2, 10_000);

    expect(world.harness.state().sync.pending).toBe(true);

    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS - 1000);
    edit(world, TO_DESKTOP_1, 12_000);
    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS - 1);

    expect(write).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[1]).toStrictEqual({
      desktop: toSyncSnapshot(world.harness.state(), 12_000),
    });
    expect(world.harness.state().sync).toMatchObject({ pending: false, lastPush: 12_000 });
  });

  it('pushes nothing for a change the synced desk does not show', async () => {
    const world = await inSync();

    edit(world, THREAD_UNREAD, 10_000);
    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS * 2);

    expect(write).not.toHaveBeenCalled();
    expect(world.harness.state().sync.pending).toBe(false);
  });

  it('pushes a changed setting', async () => {
    const world = await inSync();

    world.harness.change({ type: 'settings', settings: { theme: 'bnet' } });
    world.engine.changed();
    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS);

    expect(write.mock.calls[0]?.[1]).toMatchObject({ desktop: { settings: { theme: 'bnet' } } });
  });

  it('pushes nothing when the engine is stopped while a push waits', async () => {
    const world = await inSync();

    edit(world, TO_DESKTOP_2, 10_000);
    world.engine.stop();
    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS * 2);

    expect(write).not.toHaveBeenCalled();
  });

  it('pushes nothing when no account can hold the desk any more', async () => {
    const world = await inSync();

    edit(world, TO_DESKTOP_2, 10_000);
    world.harness.setPrefs({ syncAccounts: [], syncEnabled: false });
    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS);

    expect(write).not.toHaveBeenCalled();
    expect(world.harness.state().sync.pending).toBe(false);
  });

  it('pulls from a primary it has not read yet before it pushes to it', async () => {
    const harness = syncHarness({ prefs: { syncAccounts: [], syncEnabled: false } });
    read.mockResolvedValue(ok({}));
    const engine = createEngine(harness.io);
    engine.start();
    await vi.advanceTimersByTimeAsync(0);
    harness.setPrefs({ syncAccounts: [], syncEnabled: true });

    edit({ harness, engine }, TO_DESKTOP_2, 10_000);
    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS);

    expect(read).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalled();
    expect(harness.state().sync.pending).toBe(true);

    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS);

    expect(write).toHaveBeenCalledTimes(1);
  });

  it('takes a newer server desk instead of pushing over it when it pulls first', async () => {
    const harness = syncHarness({ prefs: { syncAccounts: [], syncEnabled: false } });
    read.mockResolvedValue(ok({ desktop: served(harness.state(), 99_000_000) }));
    const engine = createEngine(harness.io);
    engine.start();
    await vi.advanceTimersByTimeAsync(0);
    harness.setPrefs({ syncAccounts: [], syncEnabled: true });

    edit({ harness, engine }, TO_DESKTOP_2, 10_000);
    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS * 2);

    expect(write).not.toHaveBeenCalled();
    expect(harness.state().layout.active).toBe(0);
    expect(harness.state().sync.pending).toBe(false);
  });
});
