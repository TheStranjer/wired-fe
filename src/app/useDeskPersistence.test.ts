/**
 * Tests for desk persistence (decision 17): nothing is written before startup
 * is ready, a change is written once after the debounce, a burst of changes is
 * written once, a change that alters nothing saved is not written, and a
 * change still waiting when the shell goes away is never written.
 */
import { renderHook } from '@testing-library/react';
import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { DeskSource } from './deskSource';
import { SAVE_DELAY_MS, useDeskPersistence } from './useDeskPersistence';
import { DeskSnapshotSchema } from '../state/deskSchema';
import { toSnapshot } from '../state/deskSnapshot';
import type { AppAction } from '../state/reducer';
import { appReducer } from '../state/reducer';
import { createStore } from '../storage/store';
import type { Store } from '../storage/store';
import { THREAD_ID, builtDesk } from '../test/deskFixtures';
import { memoryBackend } from '../test/memoryBackend';

/** A real store over a memory backend whose writes are additionally recorded. */
function recordingSource(): { source: DeskSource; set: Mock<Store['set']>; store: Store } {
  const real = createStore('desk', memoryBackend());
  const set = vi.fn<Store['set']>((key, value) => real.set(key, value));
  const store = { get: real.get, set, remove: real.remove };
  return { source: { store, deviceClass: 'desktop' }, set, store };
}

/** The built desk moved along by {@link action}. */
function after(action: AppAction): ReturnType<typeof builtDesk> {
  return appReducer(builtDesk(), action);
}

/** Switches to desktop 2: a change the saved desk shows. */
const TO_DESKTOP_2: AppAction = { type: 'layout', action: { type: 'goToDesktop', n: 2 } };

/** Marks the hidden thread window unread: a change the saved desk does not show. */
const THREAD_UNREAD: AppAction = {
  type: 'windows',
  action: { type: 'markUnread', id: THREAD_ID, count: 3, highlight: false },
};

/** Mounts the hook over {@link desk}, ready unless said otherwise. */
function mount(source: DeskSource, desk = builtDesk(), ready = true) {
  return renderHook(
    (props: { desk: typeof desk; ready: boolean }) => {
      useDeskPersistence(props.desk, source, props.ready);
    },
    { initialProps: { desk, ready } },
  );
}

describe(useDeskPersistence, () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-25T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes nothing until startup is ready', () => {
    const { source, set } = recordingSource();

    const { rerender } = mount(source, builtDesk(), false);
    vi.advanceTimersByTime(SAVE_DELAY_MS * 4);

    expect(set).not.toHaveBeenCalled();

    rerender({ desk: builtDesk(), ready: true });
    vi.advanceTimersByTime(SAVE_DELAY_MS);

    expect(set).toHaveBeenCalledTimes(1);
  });

  it('writes the desk under the device class once the delay has passed', () => {
    const { source, set, store } = recordingSource();

    mount(source);
    vi.advanceTimersByTime(SAVE_DELAY_MS - 1);

    expect(set).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    const expected = toSnapshot(
      builtDesk(),
      Date.parse('2026-11-25T10:00:00.000Z') + SAVE_DELAY_MS,
    );

    expect(store.get('desktop', DeskSnapshotSchema)).toStrictEqual(
      v.parse(DeskSnapshotSchema, expected),
    );
  });

  it('writes a burst of changes once, with the last of them', () => {
    const { source, set, store } = recordingSource();

    const { rerender } = mount(source);
    vi.advanceTimersByTime(SAVE_DELAY_MS - 1);
    rerender({ desk: after(TO_DESKTOP_2), ready: true });
    vi.advanceTimersByTime(SAVE_DELAY_MS - 1);

    expect(set).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(set).toHaveBeenCalledTimes(1);
    expect(store.get('desktop', DeskSnapshotSchema)?.layout.active).toBe(1);
  });

  it('writes again for a change the saved desk shows', () => {
    const { source, set } = recordingSource();

    const { rerender } = mount(source);
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    rerender({ desk: after(TO_DESKTOP_2), ready: true });
    vi.advanceTimersByTime(SAVE_DELAY_MS);

    expect(set).toHaveBeenCalledTimes(2);
  });

  it('does not write for a change the saved desk does not show', () => {
    const { source, set } = recordingSource();

    const { rerender } = mount(source);
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    rerender({ desk: after(THREAD_UNREAD), ready: true });
    vi.advanceTimersByTime(SAVE_DELAY_MS);

    expect(set).toHaveBeenCalledTimes(1);
  });

  it('writes nothing for a change still waiting when the shell goes away', () => {
    const { source, set } = recordingSource();

    const { unmount } = mount(source);
    unmount();
    vi.advanceTimersByTime(SAVE_DELAY_MS * 2);

    expect(set).not.toHaveBeenCalled();
  });
});
