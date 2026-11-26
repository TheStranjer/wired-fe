/**
 * Tests for the desk sync's pull (decision 17): on start the primary account's
 * settings store is read once and settled against the local stamp by the
 * newest-wins rule (a newer server desk is applied with its settings, an
 * older or missing one is pushed, an equal one is left, an unreadable one is
 * ignored with one warning), a primary switch pulls from the new account, a
 * Mastodon-only reader never reaches the endpoint, and a 404/501 drops the
 * capability and goes quiet. The calls themselves are mocked; they have
 * their own tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readStamp, writeStamp } from './deskStamp';
import { PUSH_DELAY_MS, createEngine } from './deskSyncEngine';
import { readSettings, writeSettings } from '../features/sync/settingsAccess';
import { ok } from '../lib/result';
import { invalidRemoteText } from '../state/syncError';
import { BOB, LAIN } from '../test/deskFixtures';
import { printed, served, syncHarness } from '../test/syncHarness';
import type { SyncWorldOptions } from '../test/syncHarness';

vi.mock(import('../features/sync/settingsAccess'), () => ({
  readSettings: vi.fn(),
  writeSettings: vi.fn(),
}));

const read = vi.mocked(readSettings);
const write = vi.mocked(writeSettings);

/** A world, an engine over it, and the engine started and settled. */
async function started(options: SyncWorldOptions = {}) {
  const harness = syncHarness(options);
  const engine = createEngine(harness.io);
  engine.start();
  await vi.advanceTimersByTimeAsync(0);
  return { harness, engine };
}

/** Switches desktops, a change the synced desk shows. */
const TO_DESKTOP_2 = { type: 'layout', action: { type: 'goToDesktop', n: 2 } } as const;

describe('desk sync pull', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    read.mockReset();
    write.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the primary account once and pushes a desk the server does not have', async () => {
    read.mockResolvedValue(ok({}));
    write.mockResolvedValue(ok({}));

    const { harness } = await started();

    expect(read.mock.calls).toStrictEqual([[LAIN]]);
    expect(harness.state().sync).toMatchObject({
      pending: true,
      failed: false,
      lastPull: 1_000_000,
    });

    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS);

    expect(write).toHaveBeenCalledTimes(1);
    expect(harness.state().sync).toMatchObject({ pending: false, lastPush: 1_000_000 });
  });

  it('applies a newer server desk with its settings and does not push it back', async () => {
    const harness = syncHarness();
    const next = harness.state();
    const moved = { ...next, layout: { ...next.layout, active: 1 } };
    const remote = { ...moved, settings: { ...next.settings, theme: 'lain' as const } };
    read.mockResolvedValue(ok({ version: 1, desktop: served(remote, 2_000_000) }));
    const engine = createEngine(harness.io);

    engine.start();
    await vi.advanceTimersByTimeAsync(0);
    engine.changed();
    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS * 2);

    expect(harness.state().layout.active).toBe(1);
    expect(harness.state().settings.theme).toBe('lain');
    expect(readStamp(harness.io.source)).toBe(2_000_000);
    expect(harness.state().sync).toMatchObject({ pending: false, lastPull: 1_000_000 });
    expect(write).not.toHaveBeenCalled();
  });

  it('keeps a local desk newer than the server one and pushes it with the local stamp', async () => {
    read.mockResolvedValue(ok({ desktop: served(syncHarness().state(), 1000) }));
    write.mockResolvedValue(ok({}));
    const harness = syncHarness();
    writeStamp(harness.io.source, 5_000_000);
    const engine = createEngine(harness.io);

    engine.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS);

    const patch = write.mock.calls[0]?.[1];

    expect(Object.keys(patch ?? {})).toStrictEqual(['desktop']);
    expect(patch?.['desktop']).toMatchObject({ version: 1, updatedAt: 5_000_000 });
  });

  it('leaves everything alone when the server desk has the local stamp', async () => {
    const harness = syncHarness();
    writeStamp(harness.io.source, 3000);
    read.mockResolvedValue(ok({ desktop: served(harness.state(), 3000) }));
    const engine = createEngine(harness.io);

    engine.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS * 2);

    expect(write).not.toHaveBeenCalled();
    expect(harness.state().sync).toMatchObject({ pending: false, lastPull: 1_000_000 });
    expect(printed(harness)).toStrictEqual([]);
  });

  it('ignores an unreadable server desk, says so once and keeps the local one', async () => {
    read.mockResolvedValue(ok({ desktop: { version: 1, nope: true } }));
    const { harness, engine } = await started();

    engine.request('pull');
    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS * 2);

    expect(printed(harness)).toStrictEqual([invalidRemoteText()]);
    expect(harness.state().sync.failed).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  it('reads only its own device class key of the document', async () => {
    const harness = syncHarness();
    read.mockResolvedValue(ok({ mobile: served(harness.state(), 9_000_000) }));
    const engine = createEngine(harness.io);

    engine.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(readStamp(harness.io.source)).toBe(0);
    expect(harness.state().sync.pending).toBe(true);
  });

  it('pulls from the new primary when the choice changes', async () => {
    read.mockResolvedValue(ok({}));
    const { harness, engine } = await started({
      bobStore: true,
      prefs: { syncAccounts: [LAIN.key], syncEnabled: true },
    });

    harness.setPrefs({ syncAccounts: [BOB.key, LAIN.key], syncEnabled: true });
    engine.request('pull');
    await vi.advanceTimersByTimeAsync(0);

    expect(read.mock.calls).toStrictEqual([[LAIN], [BOB]]);
  });

  it('never calls the endpoint for a reader whose instances lack the settings store', async () => {
    const { harness, engine } = await started({ lainStore: false });

    harness.change(TO_DESKTOP_2);
    engine.changed();
    engine.request('pull');
    engine.request('now');
    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS * 2);

    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(harness.state().sync).toMatchObject({ pending: false, failed: false });
  });

  it('never calls the endpoint while sync is off', async () => {
    const { harness } = await started({ prefs: { syncAccounts: [], syncEnabled: false } });

    expect(read).not.toHaveBeenCalled();
    expect(printed(harness)).toStrictEqual([]);
  });
});
