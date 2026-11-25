/**
 * Tests for the desk sync when the server answers 404/501 (decision 17): the
 * instance's `settingsStore` capability is dropped, its cached profile is
 * forgotten, and the sync goes quiet: no warning and no further request. The
 * calls themselves are mocked; they have their own tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PUSH_DELAY_MS, createEngine } from './deskSyncEngine';
import { readSettings, writeSettings } from '../features/sync/settingsAccess';
import { err } from '../lib/result';
import { LAIN } from '../test/deskFixtures';
import { printed, syncHarness } from '../test/syncHarness';

vi.mock(import('../features/sync/settingsAccess'), () => ({
  readSettings: vi.fn(),
  writeSettings: vi.fn(),
}));

const read = vi.mocked(readSettings);
const write = vi.mocked(writeSettings);

/** Switches desktops, a change the synced desk shows. */
const TO_DESKTOP_2 = { type: 'layout', action: { type: 'goToDesktop', n: 2 } } as const;

/** A world whose server answers 404/501, after a change and the time to push it. */
async function unsupported() {
  read.mockResolvedValue(err({ kind: 'unsupported' }));
  const harness = syncHarness();
  const forget = vi.spyOn(harness.io.profiles, 'remove');
  const engine = createEngine(harness.io);

  engine.start();
  await vi.advanceTimersByTimeAsync(0);
  harness.change(TO_DESKTOP_2);
  engine.changed();
  await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS * 2);
  return { harness, forget };
}

describe('desk sync on a 404/501', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    read.mockReset();
    write.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('drops the capability', async () => {
    const { harness, forget } = await unsupported();

    const features = harness.state().profiles.get(LAIN.origin)?.capabilities.features;

    expect(features?.has('settingsStore')).toBe(false);
    expect(forget).toHaveBeenCalledWith(LAIN.origin);
  });

  it('goes quiet, without a warning or another request', async () => {
    const { harness } = await unsupported();

    expect(read).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalled();
    expect(printed(harness)).toStrictEqual([]);
    expect(harness.state().sync).toMatchObject({ pending: false, failed: false });
    expect(harness.state().sync.lastError).toContain('no settings store');
  });
});
