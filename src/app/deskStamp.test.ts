/**
 * Tests for the desk's local stamp: zero until one is written, read back per
 * device class, and zero again when what is stored is not a moment.
 */
import { describe, expect, it } from 'vitest';

import type { DeskSource } from './deskSource';
import { readStamp, writeStamp } from './deskStamp';
import { createStore } from '../storage/store';
import { memoryBackend } from '../test/memoryBackend';

/** A source over a fresh memory backend, for {@link deviceClass}. */
function source(deviceClass: DeskSource['deviceClass'], backend = memoryBackend()): DeskSource {
  return { store: createStore('desk', backend), deviceClass };
}

describe('desk stamp', () => {
  it('reads zero before anything was written', () => {
    expect(readStamp(source('desktop'))).toBe(0);
  });

  it('reads back what was written, per device class', () => {
    const backend = memoryBackend();

    writeStamp(source('desktop', backend), 1234);

    expect(readStamp(source('desktop', backend))).toBe(1234);
    expect(readStamp(source('mobile', backend))).toBe(0);
  });

  it('reads zero when what is stored is not a moment', () => {
    const backend = memoryBackend();
    const desk = source('desktop', backend);
    desk.store.set('stamp:desktop', 'yesterday');

    expect(readStamp(desk)).toBe(0);
  });
});
