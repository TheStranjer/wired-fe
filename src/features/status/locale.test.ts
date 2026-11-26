/**
 * Tests that the status window's topic line follows the language in use
 * (decision 19).
 */
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import { buildConfig } from '../../config/config';
import { initialAppState } from '../../state/appState';
import { installFakeLocale } from '../../test/i18n';
import { activeWindow } from '../../windows/model';

describe('the status slice in another language', () => {
  it('words its topic line from the catalog', () => {
    installFakeLocale({ features: { status: { topic: 'XX {appName}' } } });
    const state = initialAppState();

    expect(windowKind.topic(activeWindow(state.windows), state)).toBe(`XX ${buildConfig.appName}`);
  });
});
