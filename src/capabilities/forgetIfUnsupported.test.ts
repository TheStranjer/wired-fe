/**
 * Tests for the settings store's 404/501 rule (decision 5): only an
 * `unsupported` answer drops the origin's cached profile.
 */
import { describe, expect, it, vi } from 'vitest';

import { forgetIfUnsupported } from './forgetIfUnsupported';
import type { ProfileStorage } from './profileCache';
import type { SettingsStoreError } from '../api/endpoints/settingsStore';

const ORIGIN = 'https://wired.example';

/** A storage whose `remove` is a spy; the rest is never called. */
function storage(): { readonly store: ProfileStorage; readonly remove: ReturnType<typeof vi.fn> } {
  const remove = vi.fn();
  return { store: { get: vi.fn(), set: vi.fn(), remove }, remove };
}

describe(forgetIfUnsupported, () => {
  it('drops the cached profile of an origin that answered unsupported', () => {
    const { store, remove } = storage();

    expect(forgetIfUnsupported(store, ORIGIN, { kind: 'unsupported' })).toBe(true);
    expect(remove).toHaveBeenCalledWith(ORIGIN);
  });

  it.each<SettingsStoreError>([
    { kind: 'forbidden' },
    { kind: 'tooLarge' },
    { kind: 'http', status: 500, message: 'Boom' },
  ])('keeps the profile on $kind', (error) => {
    const { store, remove } = storage();

    expect(forgetIfUnsupported(store, ORIGIN, error)).toBe(false);
    expect(remove).not.toHaveBeenCalled();
  });
});
