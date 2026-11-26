/**
 * Tests that the notifications window's topic line follows the language in
 * use (decision 19).
 */
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import { dmState } from '../../test/dmWindow';
import { installFakeLocale } from '../../test/i18n';
import { activeWindow } from '../../windows/model';

describe('the notifications slice in another language', () => {
  it('words its topic line from the catalog', () => {
    installFakeLocale({ features: { notifications: { topic: 'XX notifications' } } });
    const state = dmState();

    expect(windowKind.topic(activeWindow(state.windows), state)).toBe('XX notifications');
  });
});
