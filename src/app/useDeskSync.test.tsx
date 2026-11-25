/**
 * Tests for the shell's side of the desk sync (decision 17): nothing is read
 * before startup is ready, the primary account is read once when it is, a
 * change to the desktops is pushed after the delay as `{ desktop: … }` with
 * the status line's marker raised meanwhile, a request from `/sync` pulls
 * again, and a push still waiting when the shell goes away is never sent. The
 * calls themselves are mocked; they have their own tests.
 */
import { act, renderHook } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deskSource } from './deskSource';
import { writeStamp } from './deskStamp';
import { PUSH_DELAY_MS } from './deskSyncEngine';
import { requestSync } from './syncRequests';
import { useDeskSync } from './useDeskSync';
import { readSettings, writeSettings } from '../features/sync/settingsAccess';
import { ok } from '../lib/result';
import { AppStateProvider, useAppDispatch, useAppState } from '../state/StateContext';
import { LAIN } from '../test/deskFixtures';
import { served, syncHarness } from '../test/syncHarness';

vi.mock(import('../features/sync/settingsAccess'), () => ({
  readSettings: vi.fn(),
  writeSettings: vi.fn(),
}));

const read = vi.mocked(readSettings);
const write = vi.mocked(writeSettings);

/** The signed-in desk both instances of which are detected. */
const INITIAL = syncHarness().state();

/** Switches to desktop 2: a change the synced desk shows. */
const TO_DESKTOP_2 = { type: 'layout', action: { type: 'goToDesktop', n: 2 } } as const;

/** The provider the hook runs under. */
function Wrapper(props: { readonly children: ReactNode }): JSX.Element {
  return <AppStateProvider initial={INITIAL}>{props.children}</AppStateProvider>;
}

/** Mounts the sync hook with the state and dispatch it runs over. */
function mount(ready: boolean) {
  return renderHook(
    (props: { ready: boolean }) => {
      useDeskSync(props.ready);
      return { state: useAppState(), dispatch: useAppDispatch() };
    },
    { initialProps: { ready }, wrapper: Wrapper },
  );
}

/** Lets what is waiting on the mocked calls settle. */
async function settle(ms = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe(useDeskSync, () => {
  beforeEach(() => {
    vi.useFakeTimers();
    read.mockReset();
    write.mockReset();
    write.mockResolvedValue(ok({}));
    writeStamp(deskSource(), 3000);
    read.mockResolvedValue(ok({ desktop: served(INITIAL, 3000) }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads nothing before startup is ready, and the primary once it is', async () => {
    const { rerender } = mount(false);
    await settle(PUSH_DELAY_MS);

    expect(read).not.toHaveBeenCalled();

    rerender({ ready: true });
    await settle();

    expect(read.mock.calls).toStrictEqual([[LAIN]]);
  });

  it('pushes a change to the desktops after the delay, with the marker up meanwhile', async () => {
    const { result } = mount(true);
    await settle();

    act(() => {
      result.current.dispatch(TO_DESKTOP_2);
    });

    expect(result.current.state.sync.pending).toBe(true);

    await settle(PUSH_DELAY_MS);

    expect(write).toHaveBeenCalledTimes(1);
    expect(Object.keys(write.mock.calls[0]?.[1] ?? {})).toStrictEqual(['desktop']);
    expect(result.current.state.sync.pending).toBe(false);
    expect(result.current.state.sync.lastPush).not.toBeNull();
  });

  it('pulls again when /sync asks for it', async () => {
    mount(true);
    await settle();

    act(() => {
      requestSync('pull');
    });
    await settle();

    expect(read).toHaveBeenCalledTimes(2);
  });

  it('sends nothing for a push still waiting when the shell goes away', async () => {
    const { result, unmount } = mount(true);
    await settle();
    act(() => {
      result.current.dispatch(TO_DESKTOP_2);
    });

    unmount();
    await settle(PUSH_DELAY_MS * 2);

    expect(write).not.toHaveBeenCalled();
  });
});
