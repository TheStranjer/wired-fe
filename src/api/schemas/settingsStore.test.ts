/**
 * Tests for the settings store envelope schema (decision 17): an empty object
 * is fine, the known keys keep whatever the snapshots hold, unknown extra keys
 * survive, and anything that is not the envelope fails.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { type SettingsCollection, SettingsStoreSchema } from './settingsStore';
import pleromaFixture from '../fixtures/settingsStore/pleroma.json';
import wiredFixture from '../fixtures/settingsStore/wired.json';

describe('the settings store envelope schema', () => {
  it('accepts the empty object', () => {
    expect(v.parse(SettingsStoreSchema, {})).toStrictEqual({});
  });

  it('keeps snapshots untouched, whatever they hold', () => {
    const body = { version: 1, desktop: [1, 'x'], mobile: null };

    expect(v.parse(SettingsStoreSchema, body)).toStrictEqual(body);
  });

  it('keeps unknown extra keys', () => {
    const body = { version: 1, other: { nested: true } };

    expect(v.parse(SettingsStoreSchema, body)).toStrictEqual(body);
  });

  it.each([
    ['Wired', wiredFixture.withData],
    ['Pleroma', pleromaFixture.withData],
  ])('accepts the recorded %s object with data', (_backend, body) => {
    expect(v.parse(SettingsStoreSchema, body)).toStrictEqual(body);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['text', 'text'],
    ['version 2', { version: 2 }],
  ])('rejects %s', (_name, body) => {
    expect(v.safeParse(SettingsStoreSchema, body).success).toBe(false);
  });

  it('types a snapshot collection as an array', () => {
    const feeds: SettingsCollection<string> = ['a', 'b'];

    expect(feeds).toHaveLength(2);
  });
});
