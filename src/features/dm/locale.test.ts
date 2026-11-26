/**
 * Tests that the DM slice's text follows the language in use (decision 19):
 * the topic line is read from the catalog.
 */
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import { dmState } from '../../test/dmWindow';
import { installFakeLocale } from '../../test/i18n';
import { activeWindow } from '../../windows/model';

describe('the dm slice in another language', () => {
  it('words its topic line from the catalog', () => {
    installFakeLocale({ features: { dm: { topic_with: 'XX with {mention}' } } });
    const state = dmState();

    expect(windowKind.topic(activeWindow(state.windows), state)).toBe(
      'XX with @alice@other.example',
    );
  });
});
