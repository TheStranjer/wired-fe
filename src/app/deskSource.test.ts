/**
 * Tests for the desk source (decision 17): the shared source reads this
 * device's class, and a saved desk is read back only when it is valid.
 */
import { describe, expect, it } from 'vitest';

import { deskSource, restoreDesk } from './deskSource';
import { DEVICE_CLASS } from './readDeviceClass';
import { toSnapshot } from '../state/deskSnapshot';
import { createStore } from '../storage/store';
import { BOB_HOME_ID, builtDesk } from '../test/deskFixtures';
import { memoryBackend } from '../test/memoryBackend';

describe(deskSource, () => {
  it('is one source, for this device class', () => {
    expect(deskSource()).toBe(deskSource());
    expect(deskSource().deviceClass).toBe(DEVICE_CLASS);
  });
});

describe(restoreDesk, () => {
  it('reads back the desk saved under the device class', () => {
    const desk = builtDesk();
    const store = createStore('desk', memoryBackend());
    store.set('mobile', toSnapshot(desk, 1));

    const restored = restoreDesk({ store, deviceClass: 'mobile' }, desk.accounts);

    expect(restored?.windows.activeId).toBe(BOB_HOME_ID);
  });

  it('answers null when nothing is saved for the class', () => {
    const store = createStore('desk', memoryBackend());
    store.set('mobile', toSnapshot(builtDesk(), 1));

    expect(restoreDesk({ store, deviceClass: 'desktop' }, [])).toBeNull();
  });

  it('answers null for an old version', () => {
    const store = createStore('desk', memoryBackend());
    store.set('desktop', { ...toSnapshot(builtDesk(), 1), version: 0 });

    expect(restoreDesk({ store, deviceClass: 'desktop' }, [])).toBeNull();
  });

  it('answers null without a source', () => {
    expect(restoreDesk(undefined, [])).toBeNull();
  });
});
