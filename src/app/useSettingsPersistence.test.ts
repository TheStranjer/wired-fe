/**
 * Tests for settings persistence: mount writes nothing — the record a session
 * starts with is the one the state was seeded with, and writing it could only
 * clobber storage before startup has read it; every new record that comes out
 * of the reducer goes back to the store exactly once, under `settings`; and a
 * re-render with the very same record writes again nothing.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, type Mock } from 'vitest';

import { useSettingsPersistence } from './useSettingsPersistence';
import { DEFAULT_SETTINGS, type Settings, SettingsSchema } from '../state/settings';
import { type StorageBackend, type Store, createStore } from '../storage/store';

/** A settings record with {@link Settings.effects} turned on. */
const EFFECTS_ON: Settings = { ...DEFAULT_SETTINGS, effects: true };

/** An in-memory storage backend. */
function memoryBackend(): StorageBackend {
  const entries = new Map<string, string>();

  return {
    getItem: (key) => entries.get(key) ?? null,
    removeItem: (key) => {
      entries.delete(key);
    },
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

/** A real store over a memory backend whose writes are additionally recorded. */
function recordingStore(): { store: Store; set: Mock<Store['set']> } {
  const real = createStore('persistence-test', memoryBackend());
  const set = vi.fn<Store['set']>((key, value) => real.set(key, value));

  return { store: { get: real.get, set, remove: real.remove }, set };
}

describe(useSettingsPersistence, () => {
  it('writes nothing while the record never changes', () => {
    const { store, set } = recordingStore();
    const { rerender } = renderHook(
      ({ settings }: { settings: Settings }) => {
        useSettingsPersistence(settings, store);
      },
      { initialProps: { settings: DEFAULT_SETTINGS } },
    );

    rerender({ settings: DEFAULT_SETTINGS });
    rerender({ settings: DEFAULT_SETTINGS });

    expect(set).not.toHaveBeenCalled();
  });

  it('writes the new record once when settings change', () => {
    const { store, set } = recordingStore();
    const { rerender } = renderHook(
      ({ settings }: { settings: Settings }) => {
        useSettingsPersistence(settings, store);
      },
      { initialProps: { settings: DEFAULT_SETTINGS } },
    );

    rerender({ settings: EFFECTS_ON });

    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith('settings', EFFECTS_ON);
  });

  it('writes every later change too, and only that', () => {
    const { store, set } = recordingStore();
    const clock12: Settings = { ...EFFECTS_ON, clockFormat: '12h' };
    const { rerender } = renderHook(
      ({ settings }: { settings: Settings }) => {
        useSettingsPersistence(settings, store);
      },
      { initialProps: { settings: DEFAULT_SETTINGS } },
    );

    rerender({ settings: EFFECTS_ON });
    rerender({ settings: EFFECTS_ON });
    rerender({ settings: clock12 });

    expect(set).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenLastCalledWith('settings', clock12);
  });

  it('keeps the last written record in the store', () => {
    const { store, set } = recordingStore();
    const { rerender } = renderHook(
      ({ settings }: { settings: Settings }) => {
        useSettingsPersistence(settings, store);
      },
      { initialProps: { settings: DEFAULT_SETTINGS } },
    );

    rerender({ settings: EFFECTS_ON });

    expect(set).toHaveBeenCalledWith('settings', EFFECTS_ON);
    expect(store.get('settings', SettingsSchema)).toStrictEqual(EFFECTS_ON);
  });

  it('stores again after unmount and remount with the loaded record', () => {
    const { store, set } = recordingStore();
    const hook = renderHook(
      ({ settings }: { settings: Settings }) => {
        useSettingsPersistence(settings, store);
      },
      { initialProps: { settings: DEFAULT_SETTINGS } },
    );

    hook.rerender({ settings: EFFECTS_ON });
    hook.unmount();
    set.mockClear();
    renderHook(
      ({ settings }: { settings: Settings }) => {
        useSettingsPersistence(settings, store);
      },
      { initialProps: { settings: EFFECTS_ON } },
    );

    expect(set).not.toHaveBeenCalled();
  });
});
