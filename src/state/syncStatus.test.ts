/**
 * Tests for the sync status in the app state (decision 17): a session starts
 * with nothing pending, failed or synced; an action changes only the fields it
 * names; an instance that turns out to have no settings store loses that flag
 * and nothing else, and one nobody detected is left as it is.
 */
import { describe, expect, it } from 'vitest';

import { initialAppState } from './appState';
import { type AppAction, appReducer } from './reducer';
import { INITIAL_SYNC } from './syncStatus';
import { syncHarness } from '../test/syncHarness';

const ORIGIN = 'https://a.example';

describe('sync status', () => {
  it('starts with nothing pending, failed or synced', () => {
    expect(initialAppState().sync).toStrictEqual(INITIAL_SYNC);
    expect(INITIAL_SYNC).toStrictEqual({
      pending: false,
      failed: false,
      lastPull: null,
      lastPush: null,
      lastError: null,
    });
  });

  it('changes only the fields an action names', () => {
    const marked = appReducer(initialAppState(), {
      type: 'sync',
      status: { pending: true, lastPull: 5 },
    });
    const failed = appReducer(marked, {
      type: 'sync',
      status: { pending: false, failed: true, lastError: 'Boom' },
    });

    expect(marked.sync).toStrictEqual({ ...INITIAL_SYNC, pending: true, lastPull: 5 });
    expect(failed.sync).toStrictEqual({
      pending: false,
      failed: true,
      lastPull: 5,
      lastPush: null,
      lastError: 'Boom',
    });
  });
});

describe('syncUnsupported', () => {
  const UNSUPPORTED: AppAction = { type: 'syncUnsupported', origin: ORIGIN };

  it('takes the settings store off the instance and keeps its other flags and limits', () => {
    const state = syncHarness().state();
    const before = state.profiles.get(ORIGIN)?.capabilities;
    const after = appReducer(state, UNSUPPORTED).profiles.get(ORIGIN)?.capabilities;

    expect(before?.features.has('settingsStore')).toBe(true);
    expect(after?.features.has('settingsStore')).toBe(false);
    expect(after?.maxCharacters).toBe(before?.maxCharacters);
    expect(after?.backend).toBe(before?.backend);
  });

  it('leaves the other instances alone', () => {
    const state = syncHarness({ bobStore: true }).state();
    const after = appReducer(state, UNSUPPORTED);

    expect(after.profiles.get('https://b.example')).toBe(state.profiles.get('https://b.example'));
  });

  it('leaves the state as it is when nobody detected the instance', () => {
    const state = initialAppState();

    expect(appReducer(state, UNSUPPORTED)).toBe(state);
  });
});
