/**
 * Tests for how the desk sync fails and how `/sync now` goes (decision 17):
 * every kind of failure warns once per session and the next change retries,
 * an unreachable server leaves the session working locally, and `/sync now`
 * pulls and then pushes at once. The calls themselves are mocked; they have
 * their own tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeStamp } from './deskStamp';
import { PUSH_DELAY_MS, createEngine } from './deskSyncEngine';
import { readSettings, writeSettings } from '../features/sync/settingsAccess';
import { err, ok } from '../lib/result';
import { installFakeLocale } from '../test/i18n';
import { printed, served, syncHarness } from '../test/syncHarness';

vi.mock(import('../features/sync/settingsAccess'), () => ({
  readSettings: vi.fn(),
  writeSettings: vi.fn(),
}));

const read = vi.mocked(readSettings);
const write = vi.mocked(writeSettings);

/** Switches to desktop 2 and back to 1: changes the synced desk shows. */
const TO_DESKTOP_2 = { type: 'layout', action: { type: 'goToDesktop', n: 2 } } as const;
const TO_DESKTOP_1 = { type: 'layout', action: { type: 'goToDesktop', n: 1 } } as const;

/** A world whose server holds exactly its desk, stamped as the reader's own, with the engine started. */
async function inSync() {
  const harness = syncHarness();
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
  action: typeof TO_DESKTOP_1 | typeof TO_DESKTOP_2,
  time: number,
): void {
  harness.setTime(time);
  harness.change(action);
  engine.changed();
}

describe('desk sync failures', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    read.mockReset();
    write.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('warns once per kind of error, marks the failure and retries on the next change', async () => {
    const world = await inSync();
    write
      .mockResolvedValueOnce(err({ kind: 'forbidden' }))
      .mockResolvedValueOnce(err({ kind: 'forbidden' }))
      .mockResolvedValueOnce(err({ kind: 'tooLarge' }))
      .mockResolvedValueOnce(err({ kind: 'tooLarge' }))
      .mockResolvedValue(ok({}));

    edit(world, TO_DESKTOP_2, 10_000);
    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS);

    expect(world.harness.state().sync).toMatchObject({ pending: false, failed: true });
    expect(printed(world.harness)).toHaveLength(1);

    edit(world, TO_DESKTOP_1, 20_000);
    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS);
    edit(world, TO_DESKTOP_2, 30_000);
    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS);

    expect(printed(world.harness)).toStrictEqual([
      'Sync: this login may not use the settings store. Log in again to grant access',
      'Sync: the server says the desk is too large to store',
    ]);
    expect(world.harness.state().sync.lastError).toBe(
      'Sync: the server says the desk is too large to store',
    );
  });

  it('clears the failure when the retry on the next change works', async () => {
    const world = await inSync();
    write.mockResolvedValueOnce(err({ kind: 'forbidden' })).mockResolvedValue(ok({}));

    edit(world, TO_DESKTOP_2, 10_000);
    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS);
    edit(world, TO_DESKTOP_1, 20_000);
    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS);

    expect(write).toHaveBeenCalledTimes(2);
    expect(world.harness.state().sync).toMatchObject({ failed: false, lastPush: 20_000 });
  });

  it('keeps working locally and warns once when the server cannot be reached', async () => {
    read.mockResolvedValue(err({ kind: 'network', message: 'offline' }));
    const harness = syncHarness();
    const engine = createEngine(harness.io);

    engine.start();
    await vi.advanceTimersByTimeAsync(0);
    engine.request('pull');
    engine.request('now');
    await vi.advanceTimersByTimeAsync(0);

    expect(printed(harness)).toStrictEqual(['Sync failed. Network error: offline']);
    expect(harness.state().sync).toMatchObject({ failed: true, pending: false, lastPull: null });
    expect(write).not.toHaveBeenCalled();
  });
});

describe('desk sync now', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    read.mockReset();
    write.mockReset();
    write.mockResolvedValue(ok({}));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pulls and then pushes at once, without waiting for the delay', async () => {
    read.mockResolvedValue(ok({}));
    const harness = syncHarness();
    const engine = createEngine(harness.io);

    engine.request('now');
    await vi.advanceTimersByTimeAsync(0);

    expect(read).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(printed(harness)).toStrictEqual(['Sync: up to date']);
    expect(harness.state().sync).toMatchObject({ pending: false, lastPush: 1_000_000 });

    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS * 2);

    expect(write).toHaveBeenCalledTimes(1);
  });

  it('words "up to date" in the language in use', async () => {
    installFakeLocale({ app: { sync_up_to_date: 'Sync: nothing to do' } });
    read.mockResolvedValue(ok({}));
    const harness = syncHarness();
    const engine = createEngine(harness.io);

    engine.request('now');
    await vi.advanceTimersByTimeAsync(0);

    expect(printed(harness)).toStrictEqual(['Sync: nothing to do']);
  });

  it('words "took the newer desk" in the language in use', async () => {
    installFakeLocale({ app: { sync_took_newer: 'Sync: got newer' } });
    const harness = syncHarness();
    read.mockResolvedValue(ok({ desktop: served(harness.state(), 99_000_000) }));
    const engine = createEngine(harness.io);

    engine.request('now');
    await vi.advanceTimersByTimeAsync(0);

    expect(printed(harness)).toStrictEqual(['Sync: got newer']);
  });

  it('takes a newer server desk and does not push over it', async () => {
    const harness = syncHarness();
    read.mockResolvedValue(ok({ desktop: served(harness.state(), 99_000_000) }));
    const engine = createEngine(harness.io);

    engine.request('now');
    await vi.advanceTimersByTimeAsync(0);

    expect(write).not.toHaveBeenCalled();
    expect(printed(harness)).toStrictEqual(['Sync: took the newer desk from the server']);
  });

  it('warns instead of saying it is up to date when the push fails', async () => {
    read.mockResolvedValue(ok({}));
    write.mockResolvedValue(err({ kind: 'network', message: 'offline' }));
    const harness = syncHarness();
    const engine = createEngine(harness.io);

    engine.request('now');
    await vi.advanceTimersByTimeAsync(0);

    expect(printed(harness)).toStrictEqual(['Sync failed. Network error: offline']);
    expect(harness.state().sync.failed).toBe(true);
  });
});
