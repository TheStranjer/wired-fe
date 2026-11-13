/**
 * Tests for the build-injected configuration: the test run loads the example
 * config file, so buildConfig holds its content.
 */
import { describe, expect, it } from 'vitest';

import { buildConfig } from './config';

describe('the injected build configuration', () => {
  it('equals the example configuration', () => {
    expect(buildConfig).toStrictEqual({
      appName: 'WIRED',
      instances: { mode: 'same-origin' },
    });
  });

  it('carries the app name', () => {
    expect(buildConfig.appName).toBe('WIRED');
  });

  it('uses the same-origin instance mode', () => {
    expect(buildConfig.instances.mode).toBe('same-origin');
  });
});
