/**
 * Tests that the home window's topic line follows the language in use
 * (decision 19).
 */
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import { dmState } from '../../test/dmWindow';
import { installFakeLocale } from '../../test/i18n';
import { activeWindow } from '../../windows/model';

describe('the home slice in another language', () => {
  it('words its topic line from the catalog', () => {
    installFakeLocale({ features: { home: { topic: 'XX home' } } });
    const state = dmState();

    expect(windowKind.topic(activeWindow(state.windows), state)).toBe('XX home');
  });
});
